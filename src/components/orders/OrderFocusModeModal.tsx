import React, { useState, useEffect } from 'react';
import { Order } from '../../types';
import { useStore } from '../../store';
import { X, ArrowRight, ArrowLeft, Send, Save, CheckCircle, Truck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderFocusModeModalProps {
  orders: Order[];
  initialFocusedOrderId: string | null;
  onClose: () => void;
}

export function OrderFocusModeModal({ orders, initialFocusedOrderId, onClose }: OrderFocusModeModalProps) {
  const { updateOrder } = useStore();
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(initialFocusedOrderId);

  // If the initial ID is null or not found, try to select the first order
  useEffect(() => {
    if (!focusedOrderId && orders.length > 0) {
      setFocusedOrderId(orders[0].id);
    }
  }, [orders, focusedOrderId]);

  const focusedOrder = orders.find(o => o.id === focusedOrderId) || null;
  const currentIndex = focusedOrder ? orders.findIndex(o => o.id === focusedOrder.id) : -1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft') {
         if (currentIndex > -1 && currentIndex < orders.length - 1) {
            setFocusedOrderId(orders[currentIndex + 1].id);
         }
      } else if (e.key === 'ArrowRight') {
         if (currentIndex > 0) {
            setFocusedOrderId(orders[currentIndex - 1].id);
         }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, orders]);

  if (!focusedOrder) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[95vh] sm:h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-xl font-mono">
              #{focusedOrder.orderId || focusedOrder.id}
            </span>
            <span className="bg-slate-800 text-amber-400 text-xs font-black px-2.5 py-1 rounded-xl border border-slate-700">
              {focusedOrder.status1 || 'غير محدد'} {focusedOrder.status2 ? ` - ${focusedOrder.status2}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-slate-50 flex flex-col gap-5">
           {/* Needs an editable form for the order to confirm and pass to shipping */}
        </div>

        {/* Modal Footer (Navigation & Global Actions) */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                 if (currentIndex > -1 && currentIndex < orders.length - 1) {
                    setFocusedOrderId(orders[currentIndex + 1].id);
                 }
              }}
              disabled={currentIndex === orders.length - 1}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-50 text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
              title="الطلبية التالية (سهم يسار)"
            >
              التالي <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                 if (currentIndex > 0) {
                    setFocusedOrderId(orders[currentIndex - 1].id);
                 }
              }}
              disabled={currentIndex === 0}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-50 text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
              title="الطلبية السابقة (سهم يمين)"
            >
              <ArrowRight className="w-4 h-4" /> السابق
            </button>
            <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-inner">
               طلبية {currentIndex + 1} من {orders.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 hidden sm:inline mr-2">استخدم ◄ ► للتنقل</span>
            <button
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md"
            >
              إنهاء وضع التركيز
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
