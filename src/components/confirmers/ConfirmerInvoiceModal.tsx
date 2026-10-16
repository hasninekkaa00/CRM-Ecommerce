import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { AppUser, ConfirmerInvoice, Order, ConfirmerCommissionConfig } from '../../types';
import { 
  X, 
  Receipt, 
  Check, 
  Plus, 
  Minus, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Save, 
  Printer, 
  ShoppingBag,
  Users
} from 'lucide-react';

interface ConfirmerInvoiceModalProps {
  isOpen: boolean;
  initialConfirmer?: AppUser | null;
  onClose: () => void;
  onSuccessPrint: (invoice: ConfirmerInvoice) => void;
}

export const ConfirmerInvoiceModal: React.FC<ConfirmerInvoiceModalProps> = ({
  isOpen,
  initialConfirmer,
  onClose,
  onSuccessPrint
}) => {
  const { users, orders, settings, addConfirmerInvoice, currentUserProfile } = useStore();

  const confirmers = useMemo(() => {
    return users.filter(u => u.role === 'confirmer' || u.isActive);
  }, [users]);

  const [selectedConfirmerId, setSelectedConfirmerId] = useState<string>(
    initialConfirmer?.id || (confirmers[0]?.id || '')
  );

  const selectedConfirmer = useMemo(() => {
    return confirmers.find(c => c.id === selectedConfirmerId) || null;
  }, [confirmers, selectedConfirmerId]);

  // Date range for billing
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Commission Rates
  const defaultRates: ConfirmerCommissionConfig = selectedConfirmer?.commissionConfig || settings?.assignmentSettings?.defaultCommission || {
    type: 'per_confirmed',
    ratePerAssigned: 10,
    ratePerConfirmed: 50,
    ratePerDelivered: 100
  };

  const [commissionType, setCommissionType] = useState(defaultRates.type);
  const [ratePerAssigned, setRatePerAssigned] = useState(defaultRates.ratePerAssigned || 10);
  const [ratePerConfirmed, setRatePerConfirmed] = useState(defaultRates.ratePerConfirmed || 50);
  const [ratePerDelivered, setRatePerDelivered] = useState(defaultRates.ratePerDelivered || 100);

  // Bonus and deductions
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [bonusReason, setBonusReason] = useState<string>('');
  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [deductionReason, setDeductionReason] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('بريدي موب');
  const [notes, setNotes] = useState<string>('');
  const [invoiceStatus, setInvoiceStatus] = useState<'paid' | 'pending'>('paid');

  // Selected orders state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Eligible unbilled orders for this confirmer
  const eligibleOrders = useMemo(() => {
    if (!selectedConfirmer) return [];
    return orders.filter(o => {
      // Must belong to this confirmer
      const isAssigned = o.assignedTo === selectedConfirmer.id || 
                         o.confirmedBy === selectedConfirmer.displayName || 
                         o.assignedToName === selectedConfirmer.displayName;
      if (!isAssigned) return false;

      // Must be unbilled
      if (o.isPaidToConfirmer) return false;

      // Date check
      if (o.orderDate) {
        const orderDateStr = o.orderDate.split('T')[0];
        if (periodFrom && orderDateStr < periodFrom) return false;
        if (periodTo && orderDateStr > periodTo) return false;
      }

      return true;
    });
  }, [orders, selectedConfirmer, periodFrom, periodTo]);

  // Sync selected order IDs when eligible orders change
  useEffect(() => {
    const newIds = eligibleOrders.map(o => o.id);
    setSelectedOrderIds(prev => {
      if (prev.length === newIds.length && prev.every((id, i) => id === newIds[i])) {
        return prev;
      }
      return newIds;
    });
  }, [eligibleOrders]);

  // Synchronize rate defaults when confirmer changes
  useEffect(() => {
    if (selectedConfirmer?.commissionConfig) {
      const cfg = selectedConfirmer.commissionConfig;
      setCommissionType(cfg.type);
      setRatePerAssigned(cfg.ratePerAssigned || 10);
      setRatePerConfirmed(cfg.ratePerConfirmed || 50);
      setRatePerDelivered(cfg.ratePerDelivered || 100);
    }
  }, [selectedConfirmer]);

  // Calculation of base amount and statistics
  const calculation = useMemo(() => {
    const includedOrders = eligibleOrders.filter(o => selectedOrderIds.includes(o.id));
    
    let totalAssigned = includedOrders.length;
    let totalConfirmed = 0;
    let totalDelivered = 0;
    let totalCanceled = 0;
    let totalReturned = 0;

    includedOrders.forEach(o => {
      const s1 = o.status1 || '';
      const s2 = o.status2 || '';
      if (s1 === 'مؤكد' || s1.includes('مؤكد')) totalConfirmed++;
      if (s1 === 'ملغى' || s1.includes('ملغى') || s1 === 'لا يرد') totalCanceled++;
      if (s2 === 'مستلم' || s2.includes('مستلم') || s2.includes('تم التوصيل')) totalDelivered++;
      if (s2 === 'مرتجع' || s2.includes('مرتجع')) totalReturned++;
    });

    let baseAmount = 0;
    if (commissionType === 'per_assigned') {
      baseAmount = totalAssigned * ratePerAssigned;
    } else if (commissionType === 'per_confirmed') {
      baseAmount = totalConfirmed * ratePerConfirmed;
    } else if (commissionType === 'per_delivered') {
      baseAmount = totalDelivered * ratePerDelivered;
    } else if (commissionType === 'hybrid') {
      baseAmount = (totalAssigned * ratePerAssigned) +
                   (totalConfirmed * ratePerConfirmed) +
                   (totalDelivered * ratePerDelivered);
    }

    const finalTotal = Math.max(0, baseAmount + (bonusAmount || 0) - (deductionAmount || 0));

    return {
      totalAssigned,
      totalConfirmed,
      totalDelivered,
      totalCanceled,
      totalReturned,
      baseAmount,
      finalTotal,
      includedOrders
    };
  }, [eligibleOrders, selectedOrderIds, commissionType, ratePerAssigned, ratePerConfirmed, ratePerDelivered, bonusAmount, deductionAmount]);

  const handleToggleSelectAll = () => {
    if (selectedOrderIds.length === eligibleOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(eligibleOrders.map(o => o.id));
    }
  };

  const handleToggleOrder = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSaveInvoice = async (triggerPrint = false) => {
    if (!selectedConfirmer) {
      alert('الرجاء اختيار المؤكد');
      return;
    }
    if (selectedOrderIds.length === 0) {
      alert('الرجاء اختيار طلبية واحدة على الأقل لإدراجها في الفاتورة');
      return;
    }

    try {
      setIsSubmitting(true);
      const invoiceNumber = `INV-CONF-${Date.now().toString().slice(-6)}`;
      
      const newInvoice: ConfirmerInvoice = {
        id: `conf_inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        invoiceNumber,
        confirmerId: selectedConfirmer.id,
        confirmerName: selectedConfirmer.displayName,
        confirmerEmail: selectedConfirmer.email,
        periodFrom,
        periodTo,
        commissionType,
        rates: {
          ratePerAssigned,
          ratePerConfirmed,
          ratePerDelivered
        },
        stats: {
          totalAssigned: calculation.totalAssigned,
          totalConfirmed: calculation.totalConfirmed,
          totalDelivered: calculation.totalDelivered,
          totalCanceled: calculation.totalCanceled,
          totalReturned: calculation.totalReturned
        },
        baseAmount: calculation.baseAmount,
        bonusAmount: bonusAmount || 0,
        bonusReason: bonusReason || '',
        deductionAmount: deductionAmount || 0,
        deductionReason: deductionReason || '',
        finalTotal: calculation.finalTotal,
        includedOrderIds: selectedOrderIds,
        status: invoiceStatus,
        paidAt: invoiceStatus === 'paid' ? new Date().toISOString() : undefined,
        paymentMethod,
        notes,
        createdAt: new Date().toISOString(),
        createdBy: currentUserProfile?.displayName || 'المدير'
      };

      await addConfirmerInvoice(newInvoice);

      if (triggerPrint) {
        onSuccessPrint(newInvoice);
      } else {
        onClose();
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'حدث خطأ أثناء حفظ الفاتورة');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">تحرير فاتورة وسداد مستحقات مؤكد</h2>
              <p className="text-xs text-slate-500">حساب المستحقات وتحديد الطلبيات المشمولة وإصدار إيصال السداد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {/* Top Form Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Select Confirmer */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">المؤكد المستفيد</label>
              <select
                value={selectedConfirmerId}
                onChange={(e) => setSelectedConfirmerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                {confirmers.map(c => (
                  <option key={c.id} value={c.id}>{c.displayName} ({c.email})</option>
                ))}
              </select>
            </div>

            {/* Period From */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">الفترة من</label>
              <input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
              />
            </div>

            {/* Period To */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">الفترة إلى</label>
              <input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Pricing Scheme Configuration */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between font-bold text-slate-700">
              <span>طريقة احتساب العمولة للفاتورة</span>
              <span className="text-emerald-700">{calculation.baseAmount.toLocaleString()} دج (مبلغ أساسي)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">النموذج</label>
                <select
                  value={commissionType}
                  onChange={(e) => setCommissionType(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-medium"
                >
                  <option value="per_confirmed">حسب المؤكدة</option>
                  <option value="per_delivered">حسب المستلمة</option>
                  <option value="per_assigned">حسب المسندة</option>
                  <option value="hybrid">مركب (تأكيد + تسليم)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">سعر التأكيد (دج)</label>
                <input
                  type="number"
                  value={ratePerConfirmed}
                  onChange={(e) => setRatePerConfirmed(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">سعر الاستلام (دج)</label>
                <input
                  type="number"
                  value={ratePerDelivered}
                  onChange={(e) => setRatePerDelivered(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">سعر الإسناد (دج)</label>
                <input
                  type="number"
                  value={ratePerAssigned}
                  onChange={(e) => setRatePerAssigned(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Orders Selection Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedOrderIds.length > 0 && selectedOrderIds.length === eligibleOrders.length}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-bold text-slate-700 text-xs">
                  الطلبيات المشمولة في الفاتورة ({selectedOrderIds.length} من {eligibleOrders.length})
                </span>
              </div>
              <span className="text-[11px] text-slate-500">انقر لتحديد أو استبعاد طلبيات معينة</span>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
              {eligibleOrders.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  لا توجد طلبيات غير مسددة لهذا المؤكد في الفترة المحددة
                </div>
              ) : (
                eligibleOrders.map(order => {
                  const isChecked = selectedOrderIds.includes(order.id);
                  return (
                    <div 
                      key={order.id} 
                      onClick={() => handleToggleOrder(order.id)}
                      className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                        isChecked ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'bg-white hover:bg-slate-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="font-mono text-indigo-700">{order.orderId || order.id.slice(0, 8)}</span>
                            <span>-</span>
                            <span>{order.fullName}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {order.productName || order.sku} | {order.orderDate?.split('T')[0]}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.status1 === 'مؤكد' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {order.status1 || 'جديد'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.status2 === 'مستلم' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {order.status2 || 'غير مشحون'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Adjustments: Bonus, Deductions & Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bonuses & Deductions */}
            <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="font-bold text-slate-700">تعديلات مالية إضافية</div>

              {/* Bonus */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-emerald-700 font-bold mb-1">+ مكافأة / بونص (دج)</label>
                  <input
                    type="number"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">سبب المكافأة</label>
                  <input
                    type="text"
                    placeholder="مثلاً: تحقيق الهدف الشهري"
                    value={bonusReason}
                    onChange={(e) => setBonusReason(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5"
                  />
                </div>
              </div>

              {/* Deduction */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-rose-700 font-bold mb-1">- خصومات / غرامات (دج)</label>
                  <input
                    type="number"
                    value={deductionAmount}
                    onChange={(e) => setDeductionAmount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold text-rose-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">سبب الخصم</label>
                  <input
                    type="text"
                    placeholder="مثلاً: تأخر في المعالجة"
                    value={deductionReason}
                    onChange={(e) => setDeductionReason(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5"
                  />
                </div>
              </div>
            </div>

            {/* Final Amount & Payment Details */}
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>المبلغ الأساسي للطلبيات:</span>
                  <span className="font-bold">{calculation.baseAmount.toLocaleString()} دج</span>
                </div>
                {bonusAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>مكافآت إضافية:</span>
                    <span className="font-bold">+{bonusAmount.toLocaleString()} دج</span>
                  </div>
                )}
                {deductionAmount > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>خصومات:</span>
                    <span className="font-bold">-{deductionAmount.toLocaleString()} دج</span>
                  </div>
                )}
                <div className="border-t border-emerald-200 pt-2 flex justify-between items-center">
                  <span className="text-sm font-bold text-emerald-950">المبلغ الصافي المستحق:</span>
                  <span className="text-xl font-black text-emerald-700">
                    {calculation.finalTotal.toLocaleString()} دج
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-100">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">طريقة التحويل / السداد</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800"
                  >
                    <option value="بريدي موب">بريدي موب (BaridiMob)</option>
                    <option value="نقداً (يد بيد)">نقداً (يد بيد)</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="حوالة بريدية CCP">حوالة بريدية CCP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">حالة الفاتورة</label>
                  <select
                    value={invoiceStatus}
                    onChange={(e) => setInvoiceStatus(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 font-bold"
                  >
                    <option value="paid">✅ تم الدفع والمحاسبة</option>
                    <option value="pending">⏳ معلق في انتظار التحويل</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="text-xs text-slate-500">
            {calculation.includedOrders.length} طلبية مشمولة | سيتم وسمها كـ "مدفوعة للمؤكد"
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
            >
              إلغاء
            </button>

            <button
              onClick={() => handleSaveInvoice(false)}
              disabled={isSubmitting || selectedOrderIds.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ الفاتورة فقط</span>
            </button>

            <button
              onClick={() => handleSaveInvoice(true)}
              disabled={isSubmitting || selectedOrderIds.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>حفظ ومعاينة الفاتورة للطباعة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
