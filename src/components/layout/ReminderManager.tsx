import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import toast from 'react-hot-toast';
import { Eye, Check } from 'lucide-react';

interface ReminderManagerProps {
  onViewChange?: (view: any) => void;
}

export function ReminderManager({ onViewChange }: ReminderManagerProps) {
  const orders = useStore(state => state.orders);
  const updateOrder = useStore(state => state.updateOrder);
  const activeAlertsRef = useRef<Set<string>>(new Set());

  const ordersRef = useRef(orders);
  const updateOrderRef = useRef(updateOrder);
  const onViewChangeRef = useRef(onViewChange);

  useEffect(() => {
    ordersRef.current = orders;
    updateOrderRef.current = updateOrder;
    onViewChangeRef.current = onViewChange;
  }, [orders, updateOrder, onViewChange]);

  useEffect(() => {
    const checkReminders = () => {
      const currentOrders = ordersRef.current || [];
      const currentUpdateOrder = updateOrderRef.current;
      const currentOnViewChange = onViewChangeRef.current;
      const now = new Date();

      currentOrders.forEach((order) => {
        if (!order.reminderDate || order.reminderDismissed || order.trashed || order.archived) {
          return;
        }

        // Check if order is shipped (reminders only for pre-shipping orders)
        const isShipped = !!order.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'].includes(order.status2 || '');
        if (isShipped) {
          return;
        }

        const reminderTime = new Date(order.reminderDate);

        // If the reminder time has arrived or passed
        if (now >= reminderTime) {
          const alertId = `${order.id}-${order.reminderDate}`;

          if (!activeAlertsRef.current.has(alertId)) {
            activeAlertsRef.current.add(alertId);

            // Play clean reminder sound alert
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
              gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
              oscillator.start();
              setTimeout(() => oscillator.stop(), 400);
            } catch (e) {
              console.warn('Audio reminder sound failed:', e);
            }

            // Show a custom persistent toast notification in Arabic
            toast.custom((t) => (
              <div className="relative group animate-bounce-short">
                <div 
                  className="bg-amber-50 border-2 border-amber-300 p-4 rounded-xl shadow-2xl max-w-sm w-full flex flex-col gap-3"
                  dir="rtl"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl text-amber-500 animate-pulse mt-0.5">🔔</div>
                    <div className="flex-1">
                      <h3 className="font-black text-amber-950 text-sm">تنبيه موعد التذكير بالطلبية</h3>
                      <p className="text-xs mt-1 text-amber-900 font-bold">
                        الزبون: <span className="text-indigo-700">{order.fullName}</span> ({order.phone})
                      </p>
                      {order.reminderNote && (
                        <p className="text-xs bg-amber-100/60 border border-amber-200 p-1.5 rounded-lg mt-1.5 text-amber-850 font-semibold leading-relaxed">
                          💡 {order.reminderNote}
                        </p>
                      )}
                      <p className="text-[10px] text-amber-600 mt-1 font-semibold">
                        مجدول لـ: {new Date(order.reminderDate).toLocaleString('ar-DZ')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 justify-end border-t border-amber-200/50 pt-2 shrink-0">
                    <button
                      onClick={() => {
                        toast.dismiss(t.id);
                        if (currentOnViewChange) currentOnViewChange('orders');
                        setTimeout(() => {
                          document.dispatchEvent(new CustomEvent('filter-orders', { detail: { searchTerm: order.orderId } }));
                        }, 120);
                      }}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-200 flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      عرض الطلبية
                    </button>
                    <button
                      onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                          if (currentUpdateOrder) {
                            await currentUpdateOrder(order.id, { reminderDismissed: true });
                          }
                          toast.success('تم معالجة التنبيه بنجاح');
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      تم الاتصال
                    </button>
                    <button
                      onClick={() => {
                        toast.dismiss(t.id);
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    >
                      تجاهل
                    </button>
                  </div>
                </div>
              </div>
            ), { duration: Infinity, position: 'top-left' });
          }
        }
      });
    };

    // Run check initially and then on a steady interval
    checkReminders();
    const interval = setInterval(checkReminders, 10000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
