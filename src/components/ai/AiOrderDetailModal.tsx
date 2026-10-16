import React from 'react';
import { X, User, Phone, MapPin, Package, DollarSign, Calendar, Truck, Tag, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Order } from '../../types';

interface AiOrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmOrder?: (order: Order) => void;
  onAssignShipping?: (order: Order, company: string) => void;
}

export function AiOrderDetailModal({
  order,
  isOpen,
  onClose,
  onConfirmOrder,
  onAssignShipping
}: AiOrderDetailModalProps) {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center font-mono font-bold text-base border border-white/20">
              #{order.orderId || order.id.slice(0, 6)}
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">تفاصيل الطلبية #{order.orderId}</h3>
              <p className="text-xs text-indigo-100 font-sans">تاريخ التسجيل: {order.orderDate ? new Date(order.orderDate).toLocaleString('ar-DZ') : 'غير محدد'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Status Badges Row */}
          <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">حالة التأكيد:</span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                order.status1 === 'مؤكد' ? 'bg-emerald-100 text-emerald-800' :
                order.status1 === 'ملغى' ? 'bg-rose-100 text-rose-800' :
                order.status1 === 'مؤجل' ? 'bg-amber-100 text-amber-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {order.status1 || 'جديد'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mr-auto">
              <span className="text-xs text-slate-500 font-medium">حالة الشحن والتوصيل:</span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                order.status2 === 'مستلم' || order.status2 === 'تم التوصيل' ? 'bg-emerald-100 text-emerald-800' :
                order.status2 === 'مرتجع' ? 'bg-rose-100 text-rose-800' :
                order.status2 === 'تم الشحن' || order.status2 === 'في الطريق' ? 'bg-indigo-100 text-indigo-800' :
                'bg-slate-200 text-slate-700'
              }`}>
                {order.status2 || 'غير مشحون'}
              </span>
            </div>

            {order.deliveryCompany && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                {order.deliveryCompany}
              </span>
            )}

            {order.tag && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                {order.tag}
              </span>
            )}
          </div>

          {/* Grid Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Box */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <User className="w-4 h-4 text-indigo-600" />
                بيانات العميل
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">الاسم الكامل:</span>
                  <span className="font-semibold text-slate-800">{order.fullName || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">رقم الهاتف:</span>
                  <a href={`tel:${order.phone}`} className="font-mono font-bold text-indigo-600 hover:underline flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {order.phone}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الولاية:</span>
                  <span className="font-semibold text-slate-800">{order.region || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">البلدية / العنوان:</span>
                  <span className="font-semibold text-slate-800">{order.city || order.stopdeskCommune || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">طريقة التوصيل:</span>
                  <span className="font-medium text-slate-700">{order.shippingMethod || 'توصيل للمنزل'}</span>
                </div>
              </div>
            </div>

            {/* Product & Financial Box */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Package className="w-4 h-4 text-emerald-600" />
                المنتج والمبالغ المالية
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">اسم المنتج:</span>
                  <span className="font-semibold text-slate-800 text-left max-w-[180px] truncate" title={order.productName}>
                    {order.productName}
                  </span>
                </div>
                {order.variation && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">المتغير / القياس:</span>
                    <span className="font-medium text-slate-700">{order.variation}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">الكمية المطلوبة:</span>
                  <span className="font-bold text-slate-800 px-2 py-0.5 bg-slate-100 rounded-md">
                    {order.qnts || 1} قطعة
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">سعر المنتجات:</span>
                  <span className="font-mono text-slate-700">{Number(order.priceWithoutDelivery || 0).toLocaleString()} د.ج</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">سعر التوصيل:</span>
                  <span className="font-mono text-slate-700">{Number(order.deliveryPrice || 0).toLocaleString()} د.ج</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                  <span className="font-bold text-slate-900">المجموع الكلي:</span>
                  <span className="font-mono font-extrabold text-emerald-700 text-base">
                    {Number(order.totalCharge || 0).toLocaleString()} د.ج
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Tracking */}
          {order.notes && (
            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
              <h5 className="font-bold text-amber-900 text-xs flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                ملاحظات الطلبية:
              </h5>
              <p className="text-xs text-amber-800 whitespace-pre-wrap leading-relaxed">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            معرف النظام: <span className="font-mono">{order.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {order.status1 !== 'مؤكد' && onConfirmOrder && (
              <button
                onClick={() => {
                  onConfirmOrder(order);
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                تأكيد الطلبية
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
