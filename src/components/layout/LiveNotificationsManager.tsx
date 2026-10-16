import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import toast from 'react-hot-toast';
import { Bell } from 'lucide-react';
import { playActionSound } from '../../utils/audioUtils';

export function LiveNotificationsManager() {
  const orders = useStore(state => state.orders);
  const prevOrdersLengthRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevOrdersLengthRef.current === null) {
      // First load, do not play chime
      prevOrdersLengthRef.current = orders.length;
      return;
    }

    if (orders.length > prevOrdersLengthRef.current) {
      const newCount = orders.length - prevOrdersLengthRef.current;
      
      // Play a chime sound
      playActionSound('bell');

      // Show Toast
      toast((t) => (
        <div className="flex items-center gap-3 w-full" dir="rtl">
          <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-sm text-slate-800">طلبيات جديدة!</div>
            <div className="text-xs text-slate-500">تم استلام {newCount} طلبية جديدة من المتجر.</div>
          </div>
        </div>
      ), { duration: 5000, position: 'top-center' });
    }

    prevOrdersLengthRef.current = orders.length;
  }, [orders.length]);

  return null;
}
