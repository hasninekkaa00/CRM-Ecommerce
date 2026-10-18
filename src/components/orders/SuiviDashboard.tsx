import { formatTime } from '../../utils/formatTime';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Navigation, Search, Filter, Phone, MessageCircle, MapPin, 
  Clock, Calendar, User, Package, DollarSign, Send, CheckCircle2, 
  XCircle, RotateCcw, AlertCircle, LayoutGrid, Grid2X2, Grid3X3, 
  Rows, Layers, Plus, Trash2, ExternalLink, ShieldAlert, Sparkles,
  FileSpreadsheet, PhoneCall, Building2, Tag, ChevronDown, Check, Truck,
  Maximize2, Minimize2, Settings, Edit3, Eye, Command, X, Sliders, ChevronUp,
  MessageSquare, Hash, ArrowRight, ArrowLeft, CornerDownLeft, Sparkle, Copy, RefreshCcw
} from 'lucide-react';
import { useStore } from '../../store';
import { fetchUniversalTrackingInfo } from "../../utils/universalShippingApi";
import { Order } from '../../types';
import { checkProductMatch } from '../../utils/productFilters';
import { isNoteFromToday, detectNoteTarget, formatNoteLine, NoteTarget } from '../../utils/noteUtils';
import { 
  getOrderTagsHistory, 
  getLatestTag, 
  getLatestTagName, 
  addTagToOrder, 
  removeTagFromOrder, 
  formatTagTimestamp 
} from '../../utils/tagUtils';
import { QuickAddTagModal } from './QuickAddTagModal';
import toast from 'react-hot-toast';

export interface QuickTemplateItem {
  id: string;
  text: string;
  icon: string;
}

const DEFAULT_QUICK_TEMPLATES: QuickTemplateItem[] = [
  { id: '1', text: 'لم يرد على الهاتف', icon: '📞' },
  { id: '2', text: 'طلب تأجيل الاستلام', icon: '⏳' },
  { id: '3', text: 'تأكيد العنوان والبلدية', icon: '📍' },
  { id: '4', text: 'سيستلم من مكتب الشحن', icon: '🏢' },
  { id: '5', text: 'تغيير رقم الموزع', icon: '🚗' },
  { id: '6', text: 'مستعجل تسليم اليوم', icon: '⚡' },
  { id: '7', text: 'الهاتف مغلق / غير متاح', icon: '🔇' },
  { id: '8', text: 'تم إرسال رسالة نصية', icon: '💬' }
];

export function SuiviDashboard() {
  const { orders, updateOrder, settings, globalProductFilter, inventoryProducts } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen mode state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Grid columns count state (1, 2, 3, 4, or 6)
  const [columns, setColumns] = useState<number>(() => {
    const saved = localStorage.getItem('suivi_grid_columns');
    return saved ? parseInt(saved, 10) : 3;
  });

  // Card Height / Layout Mode: 'smart' (ذكي مدمج قصير) vs 'full' (تفصيلي كامل)
  const [cardLayout, setCardLayout] = useState<'smart' | 'full'>(() => {
    const saved = localStorage.getItem('suivi_card_layout');
    return (saved as 'smart' | 'full') || 'smart';
  });

  // Quick Notes Templates state
  const [quickTemplates, setQuickTemplates] = useState<QuickTemplateItem[]>(() => {
    try {
      const saved = localStorage.getItem('suivi_quick_templates');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_QUICK_TEMPLATES;
  });

  // Modals state
  const [showNotesManager, setShowNotesManager] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null);

  // Filter states
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('في الطريق');
  const [wilayaFilter, setWilayaFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [noteFilter, setNoteFilter] = useState<'all' | 'followed_today' | 'followed_today_driver' | 'followed_today_office' | 'not_followed_today' | 'driver_notes' | 'customer_notes' | 'with_notes' | 'no_notes'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [noteTargets, setNoteTargets] = useState<Record<string, NoteTarget>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [quickTagTargetOrder, setQuickTagTargetOrder] = useState<Order | null>(null);
  const [isQuickTagModalOpen, setIsQuickTagModalOpen] = useState(false);

  const activeTags = settings?.tags || [];

  const handleAddTag = async (order: Order, tagName: string) => {
    const result = addTagToOrder(order, tagName, activeTags);
    try {
      await updateOrder(order.id, {
        tag: result.tag,
        tagsHistory: result.tagsHistory,
      });
      toast.success(`تمت إضافة التاغ "${tagName}" للطلبية`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إضافة التاغ');
    }
  };

  const handleRemoveTag = async (order: Order, tagId: string) => {
    const result = removeTagFromOrder(order, tagId, activeTags);
    try {
      await updateOrder(order.id, {
        tag: result.tag,
        tagsHistory: result.tagsHistory,
      });
      toast.success('تم حذف التاغ');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف التاغ');
    }
  };

  // Quick note drafts state per order
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [submittingNoteId, setSubmittingNoteId] = useState<string | null>(null);

  // New template draft state in manager
  const [newTmplText, setNewTmplText] = useState('');
  const [newTmplIcon, setNewTmplIcon] = useState('📌');
  const [editingTmplId, setEditingTmplId] = useState<string | null>(null);

  // Global Ctrl + F / Cmd + F keyboard listener for Spotlight Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setShowSpotlight(prev => !prev);
      } else if (e.key === 'Escape') {
        setShowSpotlight(false);
        setFocusedOrderId(null);
        setShowNotesManager(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save templates to localStorage
  const saveTemplates = (tmpls: QuickTemplateItem[]) => {
    setQuickTemplates(tmpls);
    localStorage.setItem('suivi_quick_templates', JSON.stringify(tmpls));
  };

  // Add or update template item
  const handleSaveTemplateItem = () => {
    if (!newTmplText.trim()) {
      toast.error('يرجى كتابة نص الملاحظة السريعة');
      return;
    }

    if (editingTmplId) {
      const updated = quickTemplates.map(t => 
        t.id === editingTmplId ? { ...t, text: newTmplText.trim(), icon: newTmplIcon } : t
      );
      saveTemplates(updated);
      toast.success('تم تحديث الملاحظة السريعة');
    } else {
      const newItem: QuickTemplateItem = {
        id: Date.now().toString(),
        text: newTmplText.trim(),
        icon: newTmplIcon || '📌'
      };
      saveTemplates([...quickTemplates, newItem]);
      toast.success('تمت إضافة الملاحظة السريعة');
    }

    setNewTmplText('');
    setNewTmplIcon('📌');
    setEditingTmplId(null);
  };

  // Delete template item
  const handleDeleteTemplateItem = (id: string) => {
    const updated = quickTemplates.filter(t => t.id !== id);
    saveTemplates(updated);
    toast.success('تم حذف الملاحظة السريعة');
  };

  // Restore default templates
  const handleRestoreDefaultTemplates = () => {
    saveTemplates(DEFAULT_QUICK_TEMPLATES);
    toast.success('تم استعادة الملاحظات السريعة الافتراضية');
  };

  // Fullscreen toggle function
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };



  // Save grid column preference
  const handleSetColumns = (cols: number) => {
    setColumns(cols);
    localStorage.setItem('suivi_grid_columns', cols.toString());
  };

  // Save layout preference
  const handleSetLayout = (layout: 'smart' | 'full') => {
    setCardLayout(layout);
    localStorage.setItem('suivi_card_layout', layout);
  };

  // Get unique wilayas for filter
  const uniqueWilayas = useMemo(() => {
    const list = new Set<string>();
    orders.forEach(o => {
      if (!o.trashed && !o.archived && o.region) {
        list.add(o.region.trim());
      }
    });
    return Array.from(list).sort();
  }, [orders]);

  // Get unique delivery companies for filter
  const uniqueCompanies = useMemo(() => {
    const list = new Set<string>();
    orders.forEach(o => {
      if (!o.trashed && !o.archived && o.deliveryCompany) {
        list.add(o.deliveryCompany.trim());
      }
    });
    return Array.from(list).sort();
  }, [orders]);

  // Filter orders for Suivi (specifically 'في الطريق' and related shipping statuses)
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.trashed || o.archived) return false;

      // Status check
      if (statusFilter === 'في الطريق') {
        const s1Match = (o.status1 || '').trim().toLowerCase() === 'في الطريق';
        const s2Match = (o.status2 || '').trim().toLowerCase() === 'في الطريق';
        if (!s1Match && !s2Match) return false;
      } else if (statusFilter === 'قيد التوصيل') {
        const s1Match = (o.status1 || '').trim() === 'قيد التوصيل';
        const s2Match = (o.status2 || '').trim() === 'قيد التوصيل';
        if (!s1Match && !s2Match) return false;
      } else if (statusFilter === 'تم الشحن') {
        const s1Match = (o.status1 || '').trim() === 'تم الشحن';
        const s2Match = (o.status2 || '').trim() === 'تم الشحن';
        if (!s1Match && !s2Match) return false;
      } else if (statusFilter !== 'all') {
        const s1Match = (o.status1 || '').trim() === statusFilter;
        const s2Match = (o.status2 || '').trim() === statusFilter;
        if (!s1Match && !s2Match) return false;
      }

      // Wilaya filter
      if (wilayaFilter !== 'all' && (o.region || '').trim() !== wilayaFilter) {
        return false;
      }

      // Delivery company filter
      if (companyFilter !== 'all' && (o.deliveryCompany || '').trim() !== companyFilter) {
        return false;
      }

      // Note filter
      const oNotesList = o.notes ? o.notes.split('\n').filter(n => n.trim() !== '') : [];
      const oLatestNote = oNotesList.length > 0 ? oNotesList[0] : null;

      if (noteFilter === 'followed_today') {
        if (!oLatestNote || !isNoteFromToday(oLatestNote)) return false;
      } else if (noteFilter === 'followed_today_driver') {
        if (!oLatestNote || !isNoteFromToday(oLatestNote) || detectNoteTarget(oLatestNote) !== 'driver') return false;
      } else if (noteFilter === 'followed_today_office') {
        if (!oLatestNote || !isNoteFromToday(oLatestNote) || detectNoteTarget(oLatestNote) === 'driver') return false;
      } else if (noteFilter === 'not_followed_today') {
        if (oLatestNote && isNoteFromToday(oLatestNote)) return false;
      } else if (noteFilter === 'driver_notes') {
        if (!oNotesList.some(n => detectNoteTarget(n) === 'driver')) return false;
      } else if (noteFilter === 'customer_notes') {
        if (!oNotesList.some(n => detectNoteTarget(n) === 'customer')) return false;
      } else if (noteFilter === 'with_notes' && (!o.notes || o.notes.trim() === '')) {
        return false;
      } else if (noteFilter === 'no_notes' && o.notes && o.notes.trim() !== '') {
        return false;
      }

      // Tag filter (filtering works based on the LATEST tag added to the order)
      if (tagFilter !== 'all') {
        const latestTagName = getLatestTagName(o, activeTags);
        if (tagFilter === 'none') {
          if (latestTagName !== '') return false;
        } else {
          if (latestTagName !== tagFilter) return false;
        }
      }

      // Global Product Filter
      if (globalProductFilter && globalProductFilter !== 'all') {
        if (!checkProductMatch(o, globalProductFilter, inventoryProducts || [])) {
          return false;
        }
      }

      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const nameMatch = (o.fullName || '').toLowerCase().includes(term);
        const phoneMatch = (o.phone || '').includes(term);
        const orderIdMatch = (o.orderId || o.id || '').toLowerCase().includes(term);
        const trackingMatch = (o.shippingTrackingId || '').toLowerCase().includes(term);
        const productMatch = (o.productName || '').toLowerCase().includes(term);
        const variationMatch = (o.variation || '').toLowerCase().includes(term);
        const regionMatch = (o.region || '').toLowerCase().includes(term);
        const cityMatch = (o.city || '').toLowerCase().includes(term);
        const notesMatch = (o.notes || '').toLowerCase().includes(term);

        if (!nameMatch && !phoneMatch && !orderIdMatch && !trackingMatch && !productMatch && !variationMatch && !regionMatch && !cityMatch && !notesMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, wilayaFilter, companyFilter, noteFilter, tagFilter, activeTags, searchTerm, globalProductFilter, inventoryProducts]);

  // Spotlight autocomplete candidates across all non-trashed orders
  const spotlightResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    return orders.filter(o => !o.trashed && !o.archived).filter(o => {
      const nameMatch = (o.fullName || '').toLowerCase().includes(term);
      const phoneMatch = (o.phone || '').includes(term);
      const orderIdMatch = (o.orderId || o.id || '').toLowerCase().includes(term);
      const trackingMatch = (o.shippingTrackingId || '').toLowerCase().includes(term);
      const productMatch = (o.productName || '').toLowerCase().includes(term);
      const regionMatch = (o.region || '').toLowerCase().includes(term);
      return nameMatch || phoneMatch || orderIdMatch || trackingMatch || productMatch || regionMatch;
    }).slice(0, 10);
  }, [orders, searchTerm]);

  // Total metrics
  const totalInTransitValue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.totalCharge || 0), 0);
  }, [filteredOrders]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'في الطريق' && statusFilter !== 'all') count++;
    if (wilayaFilter !== 'all') count++;
    if (companyFilter !== 'all') count++;
    if (noteFilter !== 'all') count++;
    if (tagFilter !== 'all') count++;
    if (searchTerm.trim() !== '') count++;
    return count;
  }, [statusFilter, wilayaFilter, companyFilter, noteFilter, tagFilter, searchTerm]);

  const handleResetFilters = () => {
    setStatusFilter('في الطريق');
    setWilayaFilter('all');
    setCompanyFilter('all');
    setNoteFilter('all');
    setTagFilter('all');
    setSearchTerm('');
  };

  // Handle adding a new note with exact date, timestamp, and target (customer vs driver)
  const handleAddNote = async (
    orderId: string, 
    customNoteText?: string, 
    explicitTarget?: NoteTarget
  ) => {
    const textToAdd = (customNoteText || noteDrafts[orderId] || '').trim();
    if (!textToAdd) {
      toast.error('يرجى كتابة الملاحظة أولاً');
      return;
    }

    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setSubmittingNoteId(orderId);

    const target = explicitTarget || noteTargets[orderId] || 'customer';
    const newNoteLine = formatNoteLine(textToAdd, target);

    const existingNotes = (order.notes || '').trim();
    const updatedNotes = existingNotes ? `${newNoteLine}\n${existingNotes}` : newNoteLine;

    try {
      await updateOrder(orderId, { notes: updatedNotes });
      setNoteDrafts(prev => ({ ...prev, [orderId]: '' }));
      toast.success(`تمت إضافة ${target === 'driver' ? 'ملاحظة الليفرور 🚚' : 'ملاحظة الزبون 👤'}`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ الملاحظة');
    } finally {
      setSubmittingNoteId(null);
    }
  };

  // Quick status update
  const handleQuickStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateOrder(orderId, { status2: newStatus });
      toast.success(`تم تحديث حالة الطلب إلى "${newStatus}"`);
    } catch (err) {
      console.error(err);
      toast.error('تعذر تحديث حالة الطلب');
    }
  };

  // Dynamic Tailwind grid column class mapping
  const gridColumnClass = useMemo(() => {
    switch (columns) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-1 md:grid-cols-2';
      case 3:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case 4:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
      case 6:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
      default:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    }
  }, [columns]);

  // Focused Order Object
    const currentTrackingProcessingId = useStore(state => state.currentTrackingProcessingId);

  const handleRefreshAll = () => {
    const ids = filteredOrders.filter(o => o.shippingTrackingId && o.shippingTrackingId !== 'تسليم يدوي').map(o => o.id);
    useStore.getState().addToTrackingQueue(ids);
    useStore.getState().setTrackingQueueState({ isTrackingQueueProcessing: true });
    toast.success(`تمت إضافة ${ids.length} طلبية في طابور التحديث بالخلفية`);
  };

  const handleRefreshSingle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    useStore.getState().addToTrackingQueue([id]);
    useStore.getState().setTrackingQueueState({ isTrackingQueueProcessing: true });
    toast.success(`جاري تحديث حالة الطلبية...`);
  };

  const focusedOrder = useMemo(() => {
    if (!focusedOrderId) return null;
    return orders.find(o => o.id === focusedOrderId) || null;
  }, [orders, focusedOrderId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedOrderId) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const currentIndex = filteredOrders.findIndex(o => o.id === focusedOrderId);
      if (e.key === 'ArrowLeft') {
         if (currentIndex > -1 && currentIndex < filteredOrders.length - 1) {
            setFocusedOrderId(filteredOrders[currentIndex + 1].id);
         }
      } else if (e.key === 'ArrowRight') {
         if (currentIndex > 0) {
            setFocusedOrderId(filteredOrders[currentIndex - 1].id);
         }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedOrderId, filteredOrders]);


  return (
    <div 
      ref={containerRef}
      className={`flex-1 flex flex-col h-full bg-slate-100/70 overflow-hidden ${
        isFullscreen ? 'fixed inset-2 sm:inset-4 z-50 bg-slate-100 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.2)] border-2 border-slate-200' : ''
      }`} 
      dir="rtl"
    >
      {/* Responsive Header & Filters Bar */}
      <div className="bg-white border-b border-slate-200/90 shadow-xs shrink-0">
        {/* Tier 1: Main Control Bar */}
        <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Section: Title & Metrics Chips */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-tr from-amber-500 to-orange-500 text-white rounded-xl flex items-center justify-center shadow-xs">
              <Navigation className="w-4 h-4 animate-pulse" />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-xs font-black text-slate-800">داشبورد السويفي</h1>
              <span className="bg-amber-100 text-amber-800 text-[11px] font-black px-2 py-0.5 rounded-lg border border-amber-200">
                {filteredOrders.length} طلبية
              </span>
              <span className="bg-emerald-50 text-emerald-800 text-[11px] font-black px-2 py-0.5 rounded-lg border border-emerald-200">
                {totalInTransitValue.toLocaleString()} دج
              </span>
            </div>
          </div>

          {/* Middle Section: Search Box with Clear & Spotlight Shortcut */}
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالاسم، الهاتف، البوليصة... (Ctrl + F)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => {
                if (!showSpotlight && searchTerm.length > 0) setShowSpotlight(true);
              }}
              className="w-full bg-slate-100/90 focus:bg-white text-[11px] font-bold text-slate-800 pr-8 pl-14 py-1.5 rounded-lg border border-slate-200 focus:border-amber-500 transition-all outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-9 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="مسح البحث"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setShowSpotlight(true)}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
              title="فتح مربّع البحث الفوري السريع"
            >
              <Command className="w-2.5 h-2.5" /> F
            </button>
          </div>

          {/* Right Section: Mobile Toggle, Quick Notes Manager, Card Height, Grid Switcher, Fullscreen */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            
            <button
              onClick={handleRefreshAll}
              className="flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 shadow-2xs"
              title="تحديث حالات جميع الطلبيات الظاهرة"
            >
              <RefreshCcw className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">تحديث الكل</span>
            </button>
            {/* Mobile Filters Toggle Button */}

            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`md:hidden flex items-center gap-1 text-[11px] font-black px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                showMobileFilters || activeFiltersCount > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              <span>الفلاتر</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Focus Mode Button */}
            <button
              onClick={() => {
                if (filteredOrders.length > 0) {
                  setFocusedOrderId(filteredOrders[0].id);
                } else {
                  toast.error('لا توجد طلبيات مطابقة للتركيز عليها');
                }
              }}
              className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 text-[11px] font-black px-2.5 py-1.5 rounded-lg transition-all shadow-2xs cursor-pointer animate-pulse"
              title="وضع التركيز: لتأكيد الطلبيات بسرعة واحدة تلو الأخرى"
            >
              <Eye className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">وضع التركيز</span>
            </button>

            {/* Quick Notes Manager Button */}
            <button
              onClick={() => setShowNotesManager(true)}
              className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[11px] font-black px-2.5 py-1.5 rounded-lg transition-all shadow-2xs cursor-pointer"
              title="تخصيص وإدارة سجل الملاحظات السريعة والأيقونات"
            >
              <Settings className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden xl:inline">إدارة الملاحظات</span>
            </button>

            {/* Card Height / Smart Layout Toggle Button */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => handleSetLayout('smart')}
                className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md transition-all cursor-pointer ${
                  cardLayout === 'smart'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="ارتفاع ذكي مدمج لتوفير المساحة"
              >
                <Sliders className="w-3 h-3" />
                <span className="hidden sm:inline">ذكية مدمجة</span>
              </button>
              <button
                onClick={() => handleSetLayout('full')}
                className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md transition-all cursor-pointer ${
                  cardLayout === 'full'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض مفصل كامل"
              >
                <Eye className="w-3 h-3" />
                <span className="hidden sm:inline">مفصلة</span>
              </button>
            </div>

            {/* Grid Layout Column Selector */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 hidden sm:flex">
              <button
                onClick={() => handleSetColumns(1)}
                className={`p-1 rounded-md transition-all ${
                  columns === 1 ? 'bg-white text-amber-600 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="عمود 1"
              >
                <Rows className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleSetColumns(2)}
                className={`p-1 rounded-md transition-all ${
                  columns === 2 ? 'bg-white text-amber-600 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="عمودين 2"
              >
                <Grid2X2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleSetColumns(3)}
                className={`p-1 rounded-md transition-all ${
                  columns === 3 ? 'bg-white text-amber-600 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="3 أعمدة"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleSetColumns(4)}
                className={`p-1 rounded-md transition-all ${
                  columns === 4 ? 'bg-white text-amber-600 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="4 أعمدة"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleSetColumns(6)}
                className={`p-1 rounded-md transition-all ${
                  columns === 6 ? 'bg-white text-amber-600 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="6 أعمدة"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Fullscreen Toggle Button */}
            <button
              onClick={toggleFullscreen}
              className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                isFullscreen
                  ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                  : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              }`}
              title={isFullscreen ? 'إلغاء ملء الشاشة' : 'وضع التركيز المتقدم'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Tier 2: Dedicated Responsive Filters Ribbon */}
        <div className={`px-3 py-2 bg-slate-50/80 border-t border-slate-200/60 flex flex-wrap items-center gap-2 transition-all ${
          showMobileFilters ? 'flex' : 'hidden md:flex'
        }`}>
          {/* Status Buttons */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0 flex-wrap">
            <span className="text-[10px] font-black text-slate-400 px-1">الحالة:</span>
            <button
              onClick={() => setStatusFilter('في الطريق')}
              className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'في الطريق'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              في الطريق 🚛
            </button>
            <button
              onClick={() => setStatusFilter('قيد التوصيل')}
              className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'قيد التوصيل'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              قيد التوصيل 📦
            </button>
            <button
              onClick={() => setStatusFilter('تم الشحن')}
              className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'تم الشحن'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              تم الشحن 🚚
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              الكل
            </button>
          </div>

          {/* Wilaya Filter Dropdown */}
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={wilayaFilter}
              onChange={(e) => setWilayaFilter(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">كل الولايات ({uniqueWilayas.length})</option>
              {uniqueWilayas.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Delivery Company Filter */}
          {uniqueCompanies.length > 0 && (
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">كل الشركات ({uniqueCompanies.length})</option>
                {uniqueCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note Status Filter */}
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={noteFilter}
              onChange={(e) => setNoteFilter(e.target.value as any)}
              className="bg-transparent text-[11px] font-extrabold text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">كل حالات المتابعة</option>
              <option value="followed_today">✅ تمت متابعتها اليوم</option>
              <option value="followed_today_office">🟢 تمت متابعتها اليوم (المكتب)</option>
              <option value="followed_today_driver">🚚 تمت متابعتها اليوم (ليفرور)</option>
              <option value="not_followed_today">🔴 لم تتابع اليوم</option>
              <option value="driver_notes">🚚 ملاحظات الليفرور</option>
              <option value="customer_notes">👤 ملاحظات الزبون</option>
              <option value="with_notes">بها ملاحظات 📝</option>
              <option value="no_notes">بدون ملاحظات ⏳</option>
            </select>
          </div>

          {/* Tag Filter (Filtering by Latest Tag) */}
          <div className="flex items-center gap-1 bg-indigo-50/80 px-2 py-1 rounded-xl border border-indigo-200 shadow-2xs shrink-0">
            <Tag className="w-3.5 h-3.5 text-indigo-500" />
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="bg-transparent text-[11px] font-extrabold text-indigo-900 outline-none cursor-pointer"
            >
              <option value="all">كل التاغات (الحدث)</option>
              <option value="none">بدون تاغ</option>
              {activeTags.map(tag => (
                <option key={tag.name} value={tag.name}>🏷️ {tag.name}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters Button */}
          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all shadow-2xs cursor-pointer mr-auto"
              title="إعادة ضبط الفلاتر"
            >
              <X className="w-3 h-3" />
              <span>مسح الفلاتر ({activeFiltersCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        {filteredOrders.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center max-w-lg mx-auto my-12 shadow-sm">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Navigation className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">لا توجد طلبيات في حالة (في الطريق) مطابقة</h3>
            <p className="text-xs font-medium text-slate-500 mb-6">
              تأكد من اختيار معايير التصفية الصحيحة، أو شحن طلبيات جديدة لنقلها إلى حالة (في الطريق)
            </p>
            <button
              onClick={() => {
                setStatusFilter('all');
                setWilayaFilter('all');
                setCompanyFilter('all');
                setNoteFilter('all');
                setSearchTerm('');
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              إعادة تعيين جميع الفلاتر
            </button>
          </div>
        ) : (
          <div className={`grid ${gridColumnClass} gap-4`}>
            {filteredOrders.map((order) => {
              const currentDraft = noteDrafts[order.id] || '';
              const notesList = order.notes
                ? order.notes.split('\n').filter(n => n.trim() !== '')
                : [];
              const latestNote = notesList.length > 0 ? notesList[0] : null;
              const followedToday = latestNote ? isNoteFromToday(latestNote) : false;
              const latestNoteTarget = latestNote ? detectNoteTarget(latestNote) : 'customer';
              const isFollowedByDriver = followedToday && latestNoteTarget === 'driver';
              const isFollowedByUs = followedToday && latestNoteTarget !== 'driver';

              const tagsHistory = getOrderTagsHistory(order, activeTags);

              return (
                <div
                  key={order.id}
                  onClick={() => setFocusedOrderId(order.id)}
                  className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden group cursor-pointer ${
                    isFollowedByUs ? 'border-emerald-300 ring-2 ring-emerald-400/30' : isFollowedByDriver ? 'border-orange-300 ring-2 ring-orange-400/30' : 'border-slate-200/90'
                  } shadow-2xs hover:shadow-md ${
                    cardLayout === 'smart' ? 'p-3 space-y-2' : 'p-4 space-y-3'
                  }`}
                >
                  {/* Card Top Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-slate-900 text-white text-[11px] font-black px-2 py-0.5 rounded-lg font-mono">
                        #{order.orderId || order.id}
                      </span>
                      <span className="bg-amber-500/10 text-amber-800 border border-amber-500/20 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-amber-600" />
                        {order.status2 || order.status1 || 'في الطريق'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isFollowedByUs ? (
                        <span className="bg-emerald-500 text-white border border-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                          🟢 متابع اليوم (المكتب)
                        </span>
                      ) : isFollowedByDriver ? (
                        <span className="bg-orange-500 text-white border border-orange-600 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                          🚚 متابع اليوم (ليفرور)
                        </span>
                      ) : latestNote ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          ⏳ لم يتابع اليوم
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium px-2 py-0.5 rounded-lg">
                          ⚪ بدون ملاحظة
                        </span>
                      )}



                      {order.deliveryCompany && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-slate-200">
                          {order.deliveryCompany}
                        </span>
                      )}
                      {order.lastTrackingSync && (
                         <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-100" title="آخر تحديث للحالة من شركة التوصيل">
                           {formatTime(order.lastTrackingSync)}
                         </span>
                      )}
                      <button
                        onClick={(e) => handleRefreshSingle(order.id, e)}
                        disabled={currentTrackingProcessingId === order.id}
                        className="ml-1 p-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 transition-colors cursor-pointer disabled:opacity-50"
                        title="تحديث حالة هذه الطلبية"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${currentTrackingProcessingId === order.id ? 'animate-spin text-indigo-400' : ''}`} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedOrderId(order.id);
                        }}
                        className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md transition-colors"
                        title="تكبير والتركيز على الطلبية"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Compact Customer & Package Summary */}
                  <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-7 h-7 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <h3 className="text-xs font-black text-slate-900 leading-tight truncate">
                            {order.fullName || 'زبون بدون اسم'}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 font-mono">
                            <span>{order.phone}</span>
                            {order.region && (
                              <>
                                <span>•</span>
                                <span className="text-slate-700 font-bold font-sans">{order.region}</span>
                              </>
                            )}

                          </div>
                        </div>
                      </div>

                      {/* Direct Phone / WhatsApp quick links */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`tel:${order.phone}`}
                          className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-2xs"
                          title="اتصال مباشر"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/${order.phone?.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all shadow-2xs"
                          title="مراسلة واتساب"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                        <span className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs font-black text-slate-900 shadow-2xs">
                          {(order.totalCharge || 0).toLocaleString()} دج
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ⭐ PRIMARY HERO SECTION: THE NOTE & ITS CONTENT ⭐ */}
                  <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    {latestNote ? (
                      (() => {
                        const latestTarget = detectNoteTarget(latestNote);
                        const isExpanded = !!expandedNotes[order.id];

                        return (
                          <div className={`rounded-xl border-2 transition-all overflow-hidden ${
                            followedToday 
                              ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs ring-2 ring-emerald-500/20' 
                              : 'bg-amber-50/60 border-amber-300 shadow-2xs'
                          }`}>
                            {/* Note Hero Header */}
                            <div className={`px-2.5 py-1.5 border-b flex items-center justify-between gap-1 text-[11px] font-black ${
                              followedToday 
                                ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950' 
                                : 'bg-amber-100/80 border-amber-200 text-amber-950'
                            }`}>
                              <div className="flex items-center gap-1.5">
                                {latestTarget === 'driver' ? (
                                  <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                    <Truck className="w-3 h-3" />
                                    ملاحظة ليفرور 🚚
                                  </span>
                                ) : (
                                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                    <User className="w-3 h-3" />
                                    ملاحظة زبون 👤
                                  </span>
                                )}



                                {followedToday ? (
                                  <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                    🟢 جديد اليوم
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-800">
                                    ⏳ آخر متابعة
                                  </span>
                                )}


                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(latestNote);
                                  toast.success('تم نسخ نص الملاحظة');
                                }}
                                className="p-1 hover:bg-white/80 rounded text-slate-700 hover:text-slate-950 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                title="نسخ الملاحظة"
                              >
                                <Copy className="w-3 h-3" />
                                <span>نسخ</span>
                              </button>
                            </div>

                            {/* Note Content (FULL TEXT BODY - NO TRUNCATION) */}
                            <div className="p-3 text-xs font-black text-slate-900 leading-relaxed break-words whitespace-pre-wrap select-text bg-white/70">
                              {latestNote}
                            </div>

                            {/* Past Notes Accordion if multiple */}
                            {notesList.length > 1 && (
                              <div className="border-t border-slate-200/80 bg-slate-50/90 px-2.5 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => setExpandedNotes(prev => ({ ...prev, [order.id]: !prev[order.id] }))}
                                  className="w-full flex items-center justify-between text-[11px] font-black text-slate-700 hover:text-amber-800 transition-colors cursor-pointer py-0.5"
                                >
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    سجل الملاحظات السابقة ({notesList.length - 1} ملاحظة أقدم)
                                  </span>
                                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                    {isExpanded ? 'إخفاء ▲' : 'عرض ▼'}
                                  </span>
                                </button>

                                {isExpanded && (
                                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pt-1 border-t border-slate-200">
                                    {notesList.slice(1).map((pastNote, pIdx) => {
                                      const pTarget = detectNoteTarget(pastNote);
                                      const pToday = isNoteFromToday(pastNote);
                                      return (
                                        <div 
                                          key={pIdx}
                                          className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-800 space-y-1"
                                        >
                                          <div className="flex items-center justify-between gap-1 text-[9px] text-slate-500 font-black">
                                            <span className="flex items-center gap-1">
                                              {pTarget === 'driver' ? '🚚 ليفرور' : '👤 زبون'}
                                              {pToday && (pTarget === 'driver' ? ' • 🚚 اليوم' : ' • 🟢 اليوم')}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                navigator.clipboard.writeText(pastNote);
                                                toast.success('تم النسخ');
                                              }}
                                              className="text-slate-400 hover:text-slate-700"
                                            >
                                              <Copy className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                          <p className="whitespace-pre-wrap break-words">{pastNote}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}


                              </div>
                            )}


                          </div>
                        );
                      })()
                    ) : (
                      /* No Notes Yet Banner */
                      <div className="p-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 text-amber-900 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-black">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>لم تسجل أي ملاحظة بعد - أضف أول ملاحظة بالأسفل</span>
                        </div>
                      </div>
                    )}

                    {/* Quick Template Chips */}
                    <div className="flex flex-wrap gap-1">
                      {quickTemplates.slice(0, 4).map((tmpl) => (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => handleAddNote(order.id, `${tmpl.icon} ${tmpl.text}`)}
                          className="bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200 hover:border-amber-300 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                        >
                          <span>{tmpl.icon}</span>
                          <span>{tmpl.text}</span>
                        </button>
                      ))}
                    </div>

                    {/* Fast Note Input & Target Bar */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setNoteTargets(prev => ({
                          ...prev,
                          [order.id]: prev[order.id] === 'driver' ? 'customer' : 'driver'
                        }))}
                        title={noteTargets[order.id] === 'driver' ? 'ملاحظة خاصة بالليفرور 🚚 (انقر للتبديل للزبون)' : 'ملاحظة خاصة بالزبون 👤 (انقر للتبديل لليفرور)'}
                        className={`px-2 py-1.5 rounded-xl text-[10px] font-black border transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs ${
                          noteTargets[order.id] === 'driver'
                            ? 'bg-indigo-600 text-white border-indigo-700'
                            : 'bg-blue-600 text-white border-blue-700'
                        }`}
                      >
                        {noteTargets[order.id] === 'driver' ? (
                          <>
                            <Truck className="w-3 h-3" />
                            <span>ليفرور</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3" />
                            <span>زبون</span>
                          </>
                        )}


                      </button>

                      <input
                        type="text"
                        placeholder={noteTargets[order.id] === 'driver' ? 'أضف ملاحظة ليفرور 🚚...' : 'أضف ملاحظة زبون 👤...'}
                        value={currentDraft}
                        onChange={(e) => setNoteDrafts(prev => ({ ...prev, [order.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNote(order.id);
                          }
                        }}
                        className="flex-1 bg-slate-50 text-xs font-bold text-slate-800 px-3 py-1.5 rounded-xl border border-slate-300 focus:bg-white focus:border-amber-500 outline-none shadow-2xs"
                      />

                      <button
                        onClick={() => handleAddNote(order.id)}
                        disabled={submittingNoteId === order.id || !currentDraft.trim()}
                        className={`text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                          noteTargets[order.id] === 'driver'
                            ? 'bg-indigo-600 hover:bg-indigo-700'
                            : 'bg-amber-500 hover:bg-amber-600'
                        } disabled:opacity-40`}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Tags History Box */}
                    <div className="pt-1.5 border-t border-slate-100 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-indigo-500" />
                          التاغات ({tagsHistory.length}):
                        </span>
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
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[10px] font-black px-1.5 py-0.5 rounded-lg border border-indigo-200 outline-none cursor-pointer"
                          >
                            <option value="">+ إضافة تاغ...</option>
                            <option value="__CREATE_NEW_TAG__" className="text-indigo-600 font-black bg-indigo-50">✨ + إنشاء تاغ جديد...</option>
                            {activeTags.map((t) => (
                              <option key={t.name} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickTagTargetOrder(order);
                              setIsQuickTagModalOpen(true);
                            }}
                            title="إنشاء تاغ جديد وحفظه في السحابة"
                            className="p-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md transition-colors cursor-pointer"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
                        {tagsHistory.length === 0 ? (
                          <span className="text-[9px] text-slate-400 italic">لا توجد تاغات</span>
                        ) : (
                          tagsHistory.map((t) => (
                            <span
                              key={t.id}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-black border shadow-2xs ${t.color || 'bg-slate-100 text-slate-700 border-slate-200'}`}
                            >
                              <span>{t.name}</span>
                              <span className="text-[8px] opacity-75 font-mono dir-ltr">
                                ({formatTagTimestamp(t.createdAt)})
                              </span>
                              <button
                                onClick={() => handleRemoveTag(order, t.id)}
                                className="hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                                title="حذف التاغ"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))
                        )}


                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Quick Notes Manager Modal (إدارة الملاحظات السريعة والأيقونات) */}
      {showNotesManager && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <h2 className="text-sm font-black">إدارة الملاحظات السريعة والأيقونات</h2>
              </div>
              <button 
                onClick={() => setShowNotesManager(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1">
              <p className="text-xs font-bold text-slate-600">
                يمكنك تخصيص الملاحظات السريعة التي تظهر في جميع بطاقات السويفي للكبس السريع وتسجيل التاريخ والوقت فوراً.
              </p>

              {/* Add / Edit Input Box */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <label className="text-xs font-black text-slate-800 block">
                  {editingTmplId ? 'تعديل الملاحظة السريعة' : 'إضافة ملاحظة سريعة جديدة'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="الأيقونة (إيموجي)..."
                    value={newTmplIcon}
                    onChange={(e) => setNewTmplIcon(e.target.value)}
                    className="w-16 bg-white text-center text-sm font-black p-2 rounded-xl border border-slate-300 focus:border-amber-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="نص الملاحظة (مثلاً: اتصلنا ولم يرد، غير العنوان...)"
                    value={newTmplText}
                    onChange={(e) => setNewTmplText(e.target.value)}
                    className="flex-1 bg-white text-xs font-bold text-slate-800 p-2 rounded-xl border border-slate-300 focus:border-amber-500 outline-none"
                  />
                  <button
                    onClick={handleSaveTemplateItem}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-black px-3 py-2 rounded-xl transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    {editingTmplId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{editingTmplId ? 'حفظ' : 'إضافة'}</span>
                  </button>
                </div>
              </div>

              {/* Templates List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">قائمة الملاحظات المخصصة ({quickTemplates.length}):</span>
                  <button
                    onClick={handleRestoreDefaultTemplates}
                    className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    استعادة الافتراضية
                  </button>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                  {quickTemplates.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs hover:border-amber-300 transition-all"
                    >
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                        <span className="text-base bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">{item.icon}</span>
                        <span>{item.text}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingTmplId(item.id);
                            setNewTmplText(item.text);
                            setNewTmplIcon(item.icon);
                          }}
                          className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          title="تعديل"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplateItem(item.id)}
                          className="p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-left">
              <button
                onClick={() => setShowNotesManager(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-black px-4 py-2 rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Ctrl + F Spotlight Search Modal (شريط بحث سريع ينبثق بمركز الشاشة) */}
      {showSpotlight && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-16 px-4" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
              <Search className="w-5 h-5 text-amber-500 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="ابحث فورياً باسم الزبون، رقم الهاتف، رقم الطلبية، رقم التتبع..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent text-sm font-black text-slate-900 outline-none placeholder:text-slate-400"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  مسح
                </button>
              )}
              <button
                onClick={() => setShowSpotlight(false)}
                className="p-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Spotlight Autocomplete / Results List */}
            <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {!searchTerm.trim() ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Command className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">ابدأ الكتابة للبحث السريع في كافة الطلبيات بالاسم، الهاتف، الرقم أو التتبع</p>
                  <p className="text-[10px] text-slate-400">اضغط <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono">Esc</kbd> للخروج</p>
                </div>
              ) : spotlightResults.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                  <p className="text-xs font-black">لم يتم العثور على أي نتائج مطابقة لـ "{searchTerm}"</p>
                </div>
              ) : (
                spotlightResults.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => {
                      setFocusedOrderId(order.id);
                      setShowSpotlight(false);
                    }}
                    className="p-3 bg-white hover:bg-amber-50/70 rounded-2xl border border-slate-200 hover:border-amber-300 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-amber-500 text-white font-black rounded-xl flex items-center justify-center text-xs shadow-2xs group-hover:scale-105 transition-transform">
                        #{order.orderId || order.id}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-900">{order.fullName || 'بدون اسم'}</h4>
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded font-mono">
                            {order.phone}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold mt-0.5">
                          <span>{order.region || 'غير محددة'}</span>
                          {order.productName && <span>• {order.productName}</span>}
                          {order.shippingTrackingId && <span className="text-amber-700 bg-amber-100 px-1 rounded">تتبع: {order.shippingTrackingId}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-left">
                      <div>
                        <span className="text-xs font-black text-slate-900 block">{(order.totalCharge || 0).toLocaleString()} دج</span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block">
                          {order.status2 || order.status1 || 'في الطريق'}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors rotate-180" />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-500 flex justify-between items-center">
              <span>عُثر على {spotlightResults.length} نتيجة</span>
              <span>اضغط على الطلبية لفتح التركيز التفصيلي 🔍</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Focused Order Detail Modal (تركيز على طلبية بمركز الشاشة) */}
      {focusedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-xl font-mono">
                  #{focusedOrder.orderId || focusedOrder.id}
                </span>
                <span className="bg-slate-800 text-amber-400 text-xs font-black px-2.5 py-1 rounded-xl border border-slate-700">
                  {focusedOrder.status2 || focusedOrder.status1 || 'في الطريق'}
                </span>
                {focusedOrder.shippingTrackingId && (
                  <span className="bg-slate-800 text-slate-300 text-[11px] font-bold px-2 py-0.5 rounded-lg font-mono">
                    تتبع: {focusedOrder.shippingTrackingId}
                  </span>
                )}
                            </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!focusedOrder.shippingTrackingId) {
                      toast.error('رقم التتبع غير متوفر لهذه الطلبية');
                      return;
                    }
                    useStore.getState().addToTrackingQueue([focusedOrder.id]);
                    useStore.getState().setTrackingQueueState({ isTrackingQueueProcessing: true });
                    toast.success('تم وضع الطلبية في طابور التحديث السريع');
                  }}
                  className="p-1 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  title="تحديث الحالة من شركة الشحن"
                >
                  <RefreshCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setFocusedOrderId(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              </div>
            </div>

            {/* Modal Main Content */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
              {/* Customer Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">{focusedOrder.fullName || 'زبون غير مسمى'}</h3>
                  <p className="text-xs font-bold text-slate-500 font-mono tracking-wide dir-ltr text-right mt-0.5">
                    {focusedOrder.phone}
                  </p>
                  <p className="text-xs font-extrabold text-slate-700 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>{focusedOrder.region || 'الولاية غير محددة'}</span>
                    {focusedOrder.city && <span className="text-slate-500"> - {focusedOrder.city}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${focusedOrder.phone}`}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-all shadow-xs"
                  >
                    <Phone className="w-4 h-4" />
                    <span>اتصال</span>
                  </a>
                  <a
                    href={`https://wa.me/${focusedOrder.phone?.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-all shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>واتساب</span>
                  </a>
                </div>
              </div>

              {/* Order Details & Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">تفاصيل المنتج</span>
                  <span className="text-sm font-black text-slate-900 block">{focusedOrder.productName || 'غير مسمى'}</span>
                  {focusedOrder.variation && (
                    <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md inline-block">
                      النوع: {focusedOrder.variation}
                    </span>
                  )}
                </div>

                <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">المبلغ الإجمالي والتوصيل</span>
                  <span className="text-base font-black text-emerald-900 block">
                    {(focusedOrder.totalCharge || 0).toLocaleString()} دج
                  </span>
                  <span className="text-xs font-bold text-slate-600 block">شركة التوصيل: {focusedOrder.deliveryCompany || 'غير محددة'}</span>
                </div>
              </div>

              {/* Quick Status Updates */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 block">تحديث حالة الطلبية الآن:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleQuickStatusChange(focusedOrder.id, 'تم التسليم')}
                    className="bg-emerald-100 hover:bg-emerald-600 text-emerald-900 hover:text-white border border-emerald-300 text-xs font-black px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    مستلم / تم التسليم
                  </button>
                  <button
                    onClick={() => handleQuickStatusChange(focusedOrder.id, 'تأجيل')}
                    className="bg-amber-100 hover:bg-amber-600 text-amber-900 hover:text-white border border-amber-300 text-xs font-black px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Clock className="w-4 h-4" />
                    تأجيل الاستلام
                  </button>
                  <button
                    onClick={() => handleQuickStatusChange(focusedOrder.id, 'مرتجع')}
                    className="bg-rose-100 hover:bg-rose-600 text-rose-900 hover:text-white border border-rose-300 text-xs font-black px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    تسجيل كمرتجع
                  </button>
                </div>
              </div>

              {/* Full Interactive Note Log Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-amber-600" />
                  تسجيل الملاحظات الموثقة بالوقت والتاريخ
                </h4>

                {/* Quick Templates Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {quickTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleAddNote(focusedOrder.id, `${tmpl.icon} ${tmpl.text}`)}
                      className="bg-white hover:bg-amber-100 text-slate-700 hover:text-amber-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>{tmpl.icon}</span>
                      <span>{tmpl.text}</span>
                    </button>
                  ))}
                </div>

                {/* Target Selector in Modal */}
                <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                    توجيه الملاحظة إلى:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNoteTargets(prev => ({ ...prev, [focusedOrder.id]: 'customer' }))}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                        (noteTargets[focusedOrder.id] || 'customer') === 'customer'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      ملاحظة زبون 👤
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteTargets(prev => ({ ...prev, [focusedOrder.id]: 'driver' }))}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                        noteTargets[focusedOrder.id] === 'driver'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      ملاحظة ليفرور 🚚
                    </button>
                  </div>
                </div>

                {/* Input box */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={noteTargets[focusedOrder.id] === 'driver' ? 'أكتب ملاحظة خاصة بالليفرور 🚚...' : 'أكتب ملاحظة خاصة بالزبون 👤...'}
                    value={noteDrafts[focusedOrder.id] || ''}
                    onChange={(e) => setNoteDrafts(prev => ({ ...prev, [focusedOrder.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNote(focusedOrder.id);
                      }
                    }}
                    className="flex-1 bg-white text-xs font-bold text-slate-800 p-2.5 rounded-xl border border-slate-300 focus:border-amber-500 outline-none"
                  />
                  <button
                    onClick={() => handleAddNote(focusedOrder.id)}
                    disabled={submittingNoteId === focusedOrder.id || !(noteDrafts[focusedOrder.id] || '').trim()}
                    className={`text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                      noteTargets[focusedOrder.id] === 'driver'
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-amber-500 hover:bg-amber-600'
                    } disabled:opacity-50`}
                  >
                    <Send className="w-4 h-4" />
                    حفظ
                  </button>
                </div>

                {/* History Log */}
                <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pt-1">
                  {focusedOrder.notes ? (
                    focusedOrder.notes.split('\n').filter(n => n.trim() !== '').map((noteLine, idx) => {
                      const isToday = isNoteFromToday(noteLine);
                      const noteTarget = detectNoteTarget(noteLine);
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-between gap-2 ${
                            isToday && noteTarget === 'driver'
                              ? 'bg-orange-50 border-2 border-orange-500 text-orange-950 font-black'
                              : isToday
                              ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-black'
                              : 'bg-white border border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {noteTarget === 'driver' ? (
                              <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 shadow-2xs">
                                <Truck className="w-3 h-3" />
                                ملاحظة ليفرور
                              </span>
                            ) : (
                              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 shadow-2xs">
                                <User className="w-3 h-3" />
                                ملاحظة زبون
                              </span>
                            )}


                            <span className="truncate">{noteLine}</span>
                          </div>

                          {isToday && (
                            <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shrink-0">
                              🟢 متابعة اليوم
                            </span>
                          )}


                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-3">لا توجد ملاحظات سابقة مسجلة على هذه الطلبية</p>
                  )}
                </div>

                {/* Tags History Box in Modal */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-indigo-600" />
                      مربع التاغات والحالات التي مرت بها الطلبية
                    </h4>

                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddTag(focusedOrder, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-black px-3 py-1.5 rounded-xl border border-indigo-200 outline-none cursor-pointer"
                    >
                      <option value="">+ إضافة تاغ جديد</option>
                      {activeTags.map((t) => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar bg-white p-2.5 rounded-xl border border-slate-200">
                    {getOrderTagsHistory(focusedOrder, activeTags).length === 0 ? (
                      <span className="text-xs text-slate-400 italic">لا توجد تاغات مضافة بعد. اختر تاغ لإضافته.</span>
                    ) : (
                      getOrderTagsHistory(focusedOrder, activeTags).map((t) => (
                        <span
                          key={t.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border shadow-2xs ${t.color || 'bg-slate-100 text-slate-700 border-slate-200'}`}
                        >
                          <span>{t.name}</span>
                          <span className="text-[10px] opacity-75 font-mono dir-ltr">
                            ({formatTagTimestamp(t.createdAt)})
                          </span>
                          <button
                            onClick={() => handleRemoveTag(focusedOrder, t.id)}
                            className="hover:text-rose-600 p-0.5 rounded-md transition-colors cursor-pointer"
                            title="حذف هذا التاغ"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                     const currentIndex = filteredOrders.findIndex(o => o.id === focusedOrder.id);
                     if (currentIndex > -1 && currentIndex < filteredOrders.length - 1) {
                        setFocusedOrderId(filteredOrders[currentIndex + 1].id);
                     }
                  }}
                  disabled={filteredOrders.findIndex(o => o.id === focusedOrder.id) === filteredOrders.length - 1}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 disabled:opacity-50 text-xs font-black px-4 py-2 rounded-xl cursor-pointer flex items-center gap-1 transition-all"
                  title="الطلبية التالية (سهم يسار)"
                >
                  التالي <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                     const currentIndex = filteredOrders.findIndex(o => o.id === focusedOrder.id);
                     if (currentIndex > 0) {
                        setFocusedOrderId(filteredOrders[currentIndex - 1].id);
                     }
                  }}
                  disabled={filteredOrders.findIndex(o => o.id === focusedOrder.id) === 0}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 disabled:opacity-50 text-xs font-black px-4 py-2 rounded-xl cursor-pointer flex items-center gap-1 transition-all"
                  title="الطلبية السابقة (سهم يمين)"
                >
                  <ArrowRight className="w-3.5 h-3.5" /> السابق
                </button>
                <span className="text-xs font-black text-slate-500 bg-slate-200/50 px-3 py-1.5 rounded-lg border border-slate-200">
                   طلبية {filteredOrders.findIndex(o => o.id === focusedOrder.id) + 1} من {filteredOrders.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 hidden sm:inline mr-2">يمكنك استخدام أسهم الكيبورد ◄ ►</span>
                <button
                  onClick={() => setFocusedOrderId(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-5 py-2 rounded-xl cursor-pointer transition-all shadow-md"
                >
                  إنهاء وضع التركيز
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Tag Modal */}
      <QuickAddTagModal
        isOpen={isQuickTagModalOpen}
        targetOrder={quickTagTargetOrder}
        onClose={() => {
          setIsQuickTagModalOpen(false);
          setQuickTagTargetOrder(null);
        }}
      />
    </div>
  );
}

