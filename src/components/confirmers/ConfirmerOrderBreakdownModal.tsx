import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { AppUser, Order } from '../../types';
import { 
  X, 
  Eye, 
  Receipt, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Truck, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  FileText,
  User
} from 'lucide-react';

interface ConfirmerOrderBreakdownModalProps {
  confirmer: AppUser;
  onClose: () => void;
  onOpenInvoice: () => void;
}

export const ConfirmerOrderBreakdownModal: React.FC<ConfirmerOrderBreakdownModalProps> = ({
  confirmer,
  onClose,
  onOpenInvoice
}) => {
  const { orders } = useStore();

  const [filterPaidStatus, setFilterPaidStatus] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [filterStatus1, setFilterStatus1] = useState<string>('all');
  const [filterStatus2, setFilterStatus2] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // All orders for this confirmer
  const userOrders = useMemo(() => {
    return orders.filter(o => 
      o.assignedTo === confirmer.id || 
      o.confirmedBy === confirmer.displayName || 
      o.assignedToName === confirmer.displayName
    );
  }, [orders, confirmer]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return userOrders.filter(o => {
      if (filterPaidStatus === 'unpaid' && o.isPaidToConfirmer) return false;
      if (filterPaidStatus === 'paid' && !o.isPaidToConfirmer) return false;

      if (filterStatus1 !== 'all') {
        if (filterStatus1 === 'confirmed' && (!o.status1 || !o.status1.includes('مؤكد'))) return false;
        if (filterStatus1 === 'canceled' && (!o.status1 || (!o.status1.includes('ملغى') && o.status1 !== 'لا يرد' && o.status1 !== 'مرفوض'))) return false;
        if (filterStatus1 === 'pending' && (o.status1 === 'مؤكد' || o.status1?.includes('ملغى'))) return false;
      }

      if (filterStatus2 !== 'all') {
        if (filterStatus2 === 'delivered' && (!o.status2 || (!o.status2.includes('مستلم') && !o.status2.includes('تم التوصيل')))) return false;
        if (filterStatus2 === 'returned' && (!o.status2 || !o.status2.includes('مرتجع'))) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = o.orderId?.toLowerCase().includes(q) || o.id.includes(q);
        const matchName = o.fullName?.toLowerCase().includes(q);
        const matchPhone = o.phone?.includes(q);
        const matchProduct = o.productName?.toLowerCase().includes(q) || o.sku?.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchPhone && !matchProduct) return false;
      }

      return true;
    });
  }, [userOrders, filterPaidStatus, filterStatus1, filterStatus2, searchQuery]);

  // Unpaid balance preview
  const unpaidCount = userOrders.filter(o => !o.isPaidToConfirmer).length;
  const unpaidConfirmedCount = userOrders.filter(o => !o.isPaidToConfirmer && (o.status1 === 'مؤكد' || o.status1?.includes('مؤكد'))).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  كشف طلبيات المؤكد: {confirmer.displayName}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {userOrders.length} طلبية إجمالاً
                </span>
              </div>
              <p className="text-xs text-slate-500">{confirmer.email} | المستحقات غير المسددة: {unpaidConfirmedCount} طلبية مؤكدة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenInvoice}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <Receipt className="w-4 h-4" />
              <span>تحرير فاتورة سداد</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Payment Filter */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg">
              <button
                onClick={() => setFilterPaidStatus('unpaid')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  filterPaidStatus === 'unpaid' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                غير مسددة ({unpaidCount})
              </button>
              <button
                onClick={() => setFilterPaidStatus('paid')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  filterPaidStatus === 'paid' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مسددة
              </button>
              <button
                onClick={() => setFilterPaidStatus('all')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  filterPaidStatus === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
            </div>

            {/* Status 1 Filter */}
            <select
              value={filterStatus1}
              onChange={(e) => setFilterStatus1(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
            >
              <option value="all">كل حالات التأكيد</option>
              <option value="confirmed">المؤكدة فقط</option>
              <option value="canceled">الملغاة / لا يرد</option>
              <option value="pending">قيد الانتظار</option>
            </select>

            {/* Status 2 Filter */}
            <select
              value={filterStatus2}
              onChange={(e) => setFilterStatus2(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
            >
              <option value="all">كل حالات الشحن</option>
              <option value="delivered">المستلمة (Livré)</option>
              <option value="returned">المرتجعة (Retour)</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="بحث بالرقم، العميل، الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg pr-8 pl-3 py-1 text-slate-800 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-y-auto flex-1 p-4">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0 bg-slate-100 z-10">
                <th className="py-2.5 px-3">رقم الطلبية</th>
                <th className="py-2.5 px-3">العميل</th>
                <th className="py-2.5 px-3">الهاتف</th>
                <th className="py-2.5 px-3">الولاية</th>
                <th className="py-2.5 px-3">المنتج</th>
                <th className="py-2.5 px-3 text-center">حالة التأكيد</th>
                <th className="py-2.5 px-3 text-center">حالة الشحن</th>
                <th className="py-2.5 px-3 text-center">حالة السداد للمؤكد</th>
                <th className="py-2.5 px-3 text-center">تاريخ الطلب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    لا توجد طلبيات تطابق الفلتر المحدد
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                      {order.orderId || order.id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {order.fullName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600" dir="ltr">
                      {order.phone}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {order.region || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {order.productName || order.sku || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        order.status1 === 'مؤكد' || order.status1?.includes('مؤكد') ? 'bg-emerald-100 text-emerald-800' :
                        order.status1?.includes('ملغى') || order.status1 === 'لا يرد' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {order.status1 || 'جديد'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        order.status2 === 'مستلم' || order.status2?.includes('مستلم') ? 'bg-blue-100 text-blue-800' :
                        order.status2?.includes('مرتجع') ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {order.status2 || 'غير مشحون'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {order.isPaidToConfirmer ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>تم السداد</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px]">
                          <Clock className="w-3 h-3" />
                          <span>غير مسددة</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400 text-[11px]">
                      {order.orderDate ? order.orderDate.split('T')[0] : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs">
          <div className="text-slate-600 font-medium">
            عرض {filteredOrders.length} من أصل {userOrders.length} طلبية
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-900 transition-all"
          >
            إغلاق الكشف
          </button>
        </div>
      </div>
    </div>
  );
};
