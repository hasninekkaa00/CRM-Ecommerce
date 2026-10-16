import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, Phone, Hash, User, LayoutGrid, X, Truck } from 'lucide-react';
import { useStore } from '../../store';

export function CommandPalette({ onNavigate }: { onNavigate: (view: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { orders } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sections = [
    { id: 'dashboard', label: 'لوحة القيادة', icon: LayoutGrid },
    { id: 'orders', label: 'الطلبيات الجديدة', icon: Package },
    { id: 'shipped_orders', label: 'طلبيات التوصيل', icon: Truck },
    { id: 'suivi', label: 'السويفي (متابعة)', icon: Search },
    { id: 'inventory', label: 'المخزون', icon: Package },
  ];

  const searchResults = query
    ? orders.filter(
        (o) =>
          o.phone?.includes(query) ||
          o.fullName?.toLowerCase().includes(query.toLowerCase()) ||
          o.orderId?.includes(query) ||
          o.shippingTrackingId?.includes(query)
      ).slice(0, 5)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85dvh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="ابحث برقم الهاتف، الاسم، رقم التتبع... أو تنقل"
            className="flex-1 bg-transparent outline-none text-slate-800 text-base placeholder:text-slate-400 font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          {!query && (
            <div>
              <div className="px-3 py-2 text-xs font-bold text-slate-500">الانتقال السريع</div>
              {sections.map((sec) => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      onNavigate(sec.id);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors text-right"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-bold text-sm">{sec.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {query && searchResults.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-bold text-slate-500">نتائج الطلبيات</div>
              {searchResults.map((order) => (
                <button
                  key={order.id}
                  onClick={() => {
                    // Navigate to appropriate section based on status
                    if (order.status1 === 'تم التأكيد' && (order.status2 || '') !== 'جاهزة للإرسال') {
                       onNavigate('shipped_orders');
                    } else {
                       onNavigate('orders');
                    }
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800">{order.fullName || 'بدون اسم'}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {order.phone}</span>
                        <span className="flex items-center gap-1"><Hash className="w-3 h-3"/> {order.orderId || order.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-bold px-2 py-1 bg-amber-50 text-amber-700 rounded-lg">
                    {order.status2 || order.status1}
                  </div>
                </button>
              ))}
            </div>
          )}

          {query && searchResults.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              لم يتم العثور على نتائج مطابقة لـ "{query}"
            </div>
          )}
        </div>
        <div className="bg-slate-50 p-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-center gap-4 font-mono">
          <span><kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5">↑↓</kbd> للتنقل</span>
          <span><kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5">Enter</kbd> للاختيار</span>
          <span><kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5">Esc</kbd> للإغلاق</span>
        </div>
      </div>
    </div>
  );
}
