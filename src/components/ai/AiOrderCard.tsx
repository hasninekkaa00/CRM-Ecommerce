import React from 'react';
import { 
  Package, 
  MapPin, 
  Phone, 
  User, 
  Truck, 
  Tag, 
  CheckCircle2, 
  Eye, 
  ExternalLink,
  Calendar
} from 'lucide-react';
import { Order } from '../../types';

interface AiOrderCardProps {
  order: Order;
  isSelected?: boolean;
  onToggleSelect?: (orderId: string) => void;
  onViewDetails?: (order: Order) => void;
  onQuickConfirm?: (order: Order) => void;
  onQuickShip?: (order: Order) => void;
  onQuickTag?: (order: Order) => void;
}

export function AiOrderCard({
  order,
  isSelected = false,
  onToggleSelect,
  onViewDetails,
  onQuickConfirm,
  onQuickShip,
  onQuickTag
}: AiOrderCardProps) {
  const isConfirmed = order.status1 === 'مؤكد';
  const isDelivered = order.status2 === 'مستلم' || order.status2 === 'تم التوصيل';
  const isReturned = order.status2 === 'مرتجع';
  const isShipped = order.status2 === 'تم الشحن' || order.status2 === 'في الطريق';

  return (
    <div 
      className={`group relative rounded-xl border transition-all duration-200 bg-white overflow-hidden shadow-xs hover:shadow-md ${
        isSelected 
          ? 'border-indigo-500 ring-2 ring-indigo-200/80 bg-indigo-50/20' 
          : 'border-slate-200 hover:border-indigo-300'
      }`}
      dir="rtl"
    >
      {/* Top Bar: Checkbox + ID + Badges */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(order.id)}
              className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500 cursor-pointer"
              title="تحديد الطلبية لإجراء عمليات مجمعة"
            />
          )}
          <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            #{order.orderId || order.id.slice(0, 6)}
          </span>
          {order.orderDate && (
            <span className="text-[11px] text-slate-500 hidden sm:inline-flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              {new Date(order.orderDate).toLocaleDateString('ar-DZ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Status 1 */}
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            isConfirmed ? 'bg-emerald-100 text-emerald-800' :
            order.status1 === 'ملغى' ? 'bg-rose-100 text-rose-800' :
            order.status1 === 'مؤجل' ? 'bg-amber-100 text-amber-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {order.status1 || 'جديد'}
          </span>

          {/* Status 2 */}
          {order.status2 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isDelivered ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              isReturned ? 'bg-rose-50 text-rose-700 border border-rose-200' :
              isShipped ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
              'bg-slate-100 text-slate-600'
            }`}>
              {order.status2}
            </span>
          )}

          {order.tag && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-0.5">
              <Tag className="w-2.5 h-2.5" />
              {order.tag}
            </span>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div 
        onClick={() => onViewDetails?.(order)}
        className="p-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          {/* Customer */}
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {order.fullName || 'عميل غير مسجل'}
            </h4>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 font-mono text-indigo-600 font-semibold" dir="ltr">
                <Phone className="w-3 h-3 text-slate-400" />
                {order.phone}
              </span>
              {(order.region || order.city) && (
                <span className="flex items-center gap-1 truncate text-slate-600">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  {order.region} {order.city ? `(${order.city})` : ''}
                </span>
              )}
            </div>
          </div>

          {/* Total Price */}
          <div className="text-left shrink-0">
            <span className="font-mono font-extrabold text-emerald-700 text-sm block">
              {Number(order.totalCharge || 0).toLocaleString()} د.ج
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {order.shippingMethod || 'توصيل للمنزل'}
            </span>
          </div>
        </div>

        {/* Product preview line */}
        <div className="flex items-center justify-between text-xs text-slate-700 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 truncate">
            <Package className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="font-medium truncate">{order.productName || 'منتج غير محدد'}</span>
            {order.variation && (
              <span className="text-slate-400 text-[11px] truncate">({order.variation})</span>
            )}
          </div>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[11px] shrink-0">
            × {order.qnts || 1}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-3 py-2 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs">
        <div className="flex items-center gap-1">
          {order.deliveryCompany ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              <Truck className="w-3 h-3 text-indigo-600" />
              {order.deliveryCompany}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">بدون شركة شحن</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isConfirmed && onQuickConfirm && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickConfirm(order);
              }}
              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] transition-colors flex items-center gap-1 border border-emerald-200"
              title="تأكيد الطلبية مباشرة"
            >
              <CheckCircle2 className="w-3 h-3" />
              تأكيد
            </button>
          )}

          {onQuickShip && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickShip(order);
              }}
              className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors flex items-center gap-1 border border-indigo-200"
              title="إرسال إلى شركة التوصيل"
            >
              <Truck className="w-3 h-3" />
              شحن
            </button>
          )}

          {onViewDetails && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(order);
              }}
              className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition-colors flex items-center gap-1 border border-slate-200"
              title="عرض كامل التفاصيل"
            >
              <Eye className="w-3 h-3" />
              تفاصيل
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
