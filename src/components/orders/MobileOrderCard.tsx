import React from 'react';
import { motion, useAnimation } from 'motion/react';
import { Phone, CheckCircle, XCircle, Clock, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store';

export function MobileOrderCard({ order }: { order: any; key?: React.Key }) {
  const controls = useAnimation();
  const updateOrder = useStore(state => state.updateOrder);

  const handleDragEnd = async (event: any, info: any) => {
    const offset = info.offset.x;
    if (offset > 100) {
      await updateOrder(order.id, { status1: 'تم التأكيد' });
      toast.success('تم التأكيد');
    } else if (offset < -100) {
      await updateOrder(order.id, { status1: 'ملغى' });
      toast.error('تم الإلغاء');
    }
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
  };

  return (
    <div className="relative mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 md:hidden shadow-sm" dir="rtl">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-emerald-500 flex items-center justify-end pr-6 text-white font-bold rounded-r-xl">
        تأكيد <CheckCircle className="w-6 h-6 mr-2" />
      </div>
      <div className="absolute inset-y-0 left-0 w-1/2 bg-red-500 flex items-center pl-6 text-white font-bold rounded-l-xl">
        <XCircle className="w-6 h-6 ml-2" /> إلغاء
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative bg-white p-4 rounded-xl shadow-sm z-10 w-full active:cursor-grabbing"
      >
        <div className="flex justify-between items-start mb-2">
          <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-500" />
            {order.fullName || 'زبون'}
          </div>
          <div className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-mono">
            #{order.orderId || order.id}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
          <a href={`tel:${order.phone}`} className="flex items-center gap-1 text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-lg">
            <Phone className="w-3 h-3" /> <span className="font-mono" dir="ltr">{order.phone}</span>
          </a>
          <div>{order.region || 'ولاية'} - {order.city || 'بلدية'}</div>
        </div>
        <div className="flex justify-between items-center text-sm">
          <div className="font-black text-indigo-600">
            {order.totalCharge} د.ج
          </div>
          <div className={`text-[10px] px-2 py-1 rounded-md font-bold ${
            order.status1 === 'تم التأكيد' ? 'bg-emerald-50 text-emerald-600' :
            order.status1 === 'ملغى' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'
          }`}>
            {order.status1}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
            <button onClick={() => { updateOrder(order.id, { status1: 'مؤجل' }); toast.success('تم التأجيل'); }} className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-600 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border border-amber-100">
                <Clock className="w-3 h-3"/> تأجيل
            </button>
        </div>
      </motion.div>
    </div>
  );
}
