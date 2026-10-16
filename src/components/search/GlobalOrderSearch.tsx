import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Package, RefreshCw, User, MapPin, Phone, Truck, Hash, Tag, Calendar, CheckCircle2, AlertCircle, ShoppingCart, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import { useStore } from '../../store';
import toast from 'react-hot-toast';
import { ViewOrderModal } from '../orders/ViewOrderModal';
import { SourceChannelBadge } from '../../utils/channelUtils';

interface GlobalOrderSearchProps {
  onViewChange?: (view: any) => void;
}

const EMPTY_RESULTS: any[] = [];

export function GlobalOrderSearch({ onViewChange }: GlobalOrderSearchProps) {
  const { orders = [], abandonedOrders = [], settings, salesChannels, updateOrder, updateAbandonedOrder } = useStore();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTags = settings?.tags || [];

  // 🔍 Keyboard shortcut (Ctrl + K or Cmd + K or /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing inside an input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === '/' && !isTyping) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and search logic across ALL orders
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EMPTY_RESULTS;

    // Combine standard orders and abandoned orders
    const allItems = [
      ...orders.map(o => ({ ...o, _type: 'order' })),
      ...abandonedOrders.map((a: any) => ({
        ...a,
        _type: 'abandoned',
        isAbandoned: true,
        fullName: a.fullName || a.customerName || 'سلة متروكة',
        orderId: a.orderId || a.id
      }))
    ];

    return allItems.filter((item: any) => {
      const orderId = String(item.orderId || item.id || '').toLowerCase();
      const tracking = String(item.shippingTrackingId || item.trackingNumber || '').toLowerCase();
      const name = String(item.fullName || item.customerName || '').toLowerCase();
      const phone = String(item.phone || '').toLowerCase();
      const city = String(item.city || '').toLowerCase();
      const region = String(item.region || '').toLowerCase();
      const address = String(item.address || '').toLowerCase();
      const product = String(item.productName || '').toLowerCase();
      const sku = String(item.sku || '').toLowerCase();
      const variation = String(item.variation || '').toLowerCase();
      const tag = String(item.tag || '').toLowerCase();
      const tagsHistoryStr = (item.tagsHistory || []).map((t: any) => t.name).join(' ').toLowerCase();
      const status1 = String(item.status1 || '').toLowerCase();
      const status2 = String(item.status2 || '').toLowerCase();
      const confirmedBy = String(item.confirmedBy || '').toLowerCase();
      const deliveryCo = String(item.deliveryCompany || '').toLowerCase();
      const notes = String(item.notes || '').toLowerCase();
      const channel = String(item.sourceChannel || '').toLowerCase();

      return (
        orderId.includes(q) ||
        tracking.includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        city.includes(q) ||
        region.includes(q) ||
        address.includes(q) ||
        product.includes(q) ||
        sku.includes(q) ||
        variation.includes(q) ||
        tag.includes(q) ||
        tagsHistoryStr.includes(q) ||
        status1.includes(q) ||
        status2.includes(q) ||
        confirmedBy.includes(q) ||
        deliveryCo.includes(q) ||
        notes.includes(q) ||
        channel.includes(q)
      );
    }).slice(0, 20); // Top 20 results
  }, [query, orders, abandonedOrders]);

  // Reset selectedIndex when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle arrow key navigation
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleOpenModal(filteredResults[selectedIndex]);
      }
    }
  };

  const handleOpenModal = (order: any) => {
    setViewingOrder(order);
    setIsOpen(false);
  };

  const handleRestoreOrder = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
      if (order._type === 'abandoned' && updateAbandonedOrder) {
        await updateAbandonedOrder(order.id, { trashed: false });
        toast.success('تم استرجاع السلة بنجاح');
      } else if (updateOrder) {
        await updateOrder(order.id, { trashed: false, archived: false });
        toast.success('تم استرجاع الطلبية بنجاح');
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء الاسترجاع');
    }
  };

  const handleNavigateToOrder = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    setIsOpen(false);
    
    let targetView = 'orders';
    if (order.isAbandoned) {
      targetView = 'abandoned';
    } else if (order.status2 && order.status2 !== 'لم يتم الشحن') {
      targetView = 'shipped_orders';
    }

    if (onViewChange) {
      onViewChange(targetView);
    }

    setTimeout(() => {
      const searchTerm = order.id || (order.orderId ? String(order.orderId) : (order.phone || order.fullName));
      document.dispatchEvent(new CustomEvent('filter-orders', { 
        detail: { 
          searchTerm,
          order,
          targetTab: order.trashed ? 'trash' : (order.archived ? 'archived' : 'active')
        } 
      }));
    }, 150);
  };

  const getTagBadgeClass = (tagName: string) => {
    const t = activeTags.find((tag: any) => tag.name === tagName);
    return t ? t.color : 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <>
      <div className="relative flex-1 w-full max-w-3xl" ref={containerRef} dir="rtl">
        {/* Search Input Box */}
        <div className="relative flex items-center">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder="البحث الشامل بالاسم، الهاتف، رقم الطلبية، الطرد، التاغ، الحالة..."
            className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 rounded-full text-sm py-2.5 pr-11 pl-20 text-slate-800 placeholder-slate-400 font-bold transition-all outline-none"
          />
          
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                  document.dispatchEvent(new CustomEvent('filter-orders', { 
                    detail: { searchTerm: '' } 
                  }));
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-full shadow-2xs">
                <kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">K</kbd>
              </span>
            )}
          </div>
        </div>

        {/* 🚀 Autocomplete Dropdown Popup */}
        {isOpen && query.trim().length > 0 && (
          <div className="absolute right-0 left-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[75vh] flex flex-col">
            
            {/* Header info */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5 text-indigo-900 font-black">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                نتائج البحث الشامل ({filteredResults.length})
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                استخدم <kbd className="font-mono text-slate-600">↑</kbd> <kbd className="font-mono text-slate-600">↓</kbd> للتنقل و <kbd className="font-mono text-slate-600">Enter</kbd> للفتح
              </span>
            </div>

            {/* Results List */}
            <div className="overflow-y-auto custom-scrollbar divide-y divide-slate-100 p-1.5">
              {filteredResults.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                  <AlertCircle className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">لم يتم العثور على أي طلبية تطابق كلمة البحث "{query}"</p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    يمكنك البحث برقم الهاتف، اسم الزبون، رقم الطرد، كود SKU، اسم المنتج، التاغ، الحالة، أو اسم الولاية.
                  </p>
                </div>
              ) : (
                filteredResults.map((order, index) => {
                  const isSelected = index === selectedIndex;
                  const isTrashed = order.trashed;
                  const isArchived = order.archived || order.isArchived;
                  const isAbandoned = order.isAbandoned;

                  return (
                    <div
                      key={order.id || index}
                      onClick={() => handleOpenModal(order)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`p-3 rounded-xl transition-all cursor-pointer flex flex-col gap-2 ${
                        isSelected 
                          ? 'bg-indigo-50/90 border border-indigo-200 shadow-2xs' 
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      {/* Top Row: ID, Badges & Price */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs font-mono">
                            #{order.orderId || order.id}
                          </span>

                          <SourceChannelBadge order={order} size="sm" configuredSalesChannels={salesChannels} />

                          {/* Location / Status State Badges */}
                          {isTrashed && (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-md text-[10px] font-black flex items-center gap-1">
                              🗑️ سلة المهملات (محذوفة)
                            </span>
                          )}
                          {isArchived && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 border border-slate-300 rounded-md text-[10px] font-black flex items-center gap-1">
                              📦 مؤرشفة
                            </span>
                          )}
                          {isAbandoned && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-md text-[10px] font-black flex items-center gap-1">
                              🛒 سلة متروكة
                            </span>
                          )}

                          {/* Delivery Status 2 Badge */}
                          {order.status2 && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                              order.status2 === 'مستلم' 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                : order.status2 === 'مرتجع' 
                                ? 'bg-rose-100 text-rose-800 border-rose-300' 
                                : order.status2 === 'في الطريق' || order.status2 === 'قيد التوصيل'
                                ? 'bg-sky-100 text-sky-800 border-sky-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              🚚 {order.status2}
                            </span>
                          )}

                          {/* Confirmation Status 1 Badge */}
                          {order.status1 && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                              order.status1 === 'مؤكد'
                                ? 'bg-teal-100 text-teal-800 border-teal-300'
                                : order.status1 === 'ملغى'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : order.status1 === 'جديد'
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}>
                              📋 {order.status1}
                            </span>
                          )}

                          {/* Tag Badges */}
                          {order.tagsHistory && order.tagsHistory.length > 0 ? (
                            order.tagsHistory.map((t: any) => (
                              <span key={t.id} className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${t.color || getTagBadgeClass(t.name)}`}>
                                🏷️ {t.name}
                              </span>
                            ))
                          ) : order.tag ? (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getTagBadgeClass(order.tag)}`}>
                              🏷️ {order.tag}
                            </span>
                          ) : null}
                        </div>

                        {/* Price */}
                        <div className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          {order.totalCharge ? `${Number(order.totalCharge).toLocaleString()} د.ج` : '0 د.ج'}
                        </div>
                      </div>

                      {/* Middle Row: Client Info & Location */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-medium text-slate-700 pt-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{order.fullName || 'بدون اسم'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-indigo-700 font-bold" dir="ltr">
                          <Phone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{order.phone || '-'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="truncate">{order.city || '-'} {order.region ? `(${order.region})` : ''}</span>
                        </div>
                      </div>

                      {/* Bottom Row: Product details & Action button */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100/80 gap-2 flex-wrap">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1 font-bold text-slate-800">
                            <Package className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            {order.productName || 'منتج غير محدد'} {order.variation ? `(${order.variation})` : ''} x{order.qnts || 1}
                          </span>

                          {order.shippingTrackingId && (
                            <span className="flex items-center gap-1 font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              <Hash className="w-3 h-3 text-indigo-400" />
                              طرد: {order.shippingTrackingId}
                            </span>
                          )}

                          {order.orderDate && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Calendar className="w-3 h-3" />
                              {order.orderDate.substring(0, 10)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleNavigateToOrder(e, order)}
                            className="px-2 py-1 bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                            title="انتقال لقائمة الطلبيات مع الفلترة"
                          >
                            <span>الانتقال إليها</span>
                            <ArrowRight className="w-3 h-3 rotate-180" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenModal(order)}
                            className="px-2 py-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                          >
                            <span>التفاصيل الكاملة</span>
                            <CornerDownLeft className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* Footer */}
            <div className="p-2 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 font-bold shrink-0">
              اضغط على أي طلبية لرؤية كافة التفاصيل، أو اختر "الانتقال إليها" لتحديد مكانها مباشرةً.
            </div>
          </div>
        )}
      </div>
      {/* Full Details Modal */}
      {viewingOrder && (
        <ViewOrderModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}
    </>
  );
}