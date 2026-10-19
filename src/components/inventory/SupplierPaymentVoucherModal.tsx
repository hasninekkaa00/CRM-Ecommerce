import React from 'react';
import { X, Printer, DollarSign, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';
import { Supplier } from '../../types';
import { triggerPrint } from '../../utils/printUtils';

interface SupplierPaymentVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  supplier?: Supplier | null;
  storeName?: string;
}

export function SupplierPaymentVoucherModal({
  isOpen,
  onClose,
  payment,
  supplier,
  storeName = 'إدارة المخزون والمشتريات'
}: SupplierPaymentVoucherModalProps) {
  if (!isOpen || !payment) return null;

  const supplierName = supplier?.name || payment.supplierName || 'غير محدد';
  const voucherNum = `VCH-${payment.id ? payment.id.slice(0, 8).toUpperCase() : Date.now().toString().slice(-6)}`;
  const amount = Number(payment.amount) || 0;

  const handlePrint = () => {
    triggerPrint({
      printableElementId: 'printable-payment-voucher',
      title: `سند_دفع_${supplierName}_${payment.date}`
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto border border-slate-200 animate-in fade-in zoom-in duration-200">
        
        {/* Actions Bar (Hidden in Print) */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">معاينة سند صرف / وصل دفعة للمورد</h3>
              <p className="text-xs text-slate-500 font-mono">{voucherNum}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السند</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div id="printable-payment-voucher" className="p-8 sm:p-10 space-y-6 bg-white text-slate-800">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
            <div>
              <span className="text-xs font-black text-emerald-700 uppercase tracking-wider block mb-1">
                {storeName}
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                سند صرف ودفع لمورد
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                سند محاسبي معتمد لإثبات دفع مستحقات المورد
              </p>
            </div>

            <div className="text-left bg-slate-50 p-3 rounded-2xl border border-slate-200 min-w-[150px]">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">رقم السند</div>
              <div className="text-sm font-black font-mono text-slate-800">{voucherNum}</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">تاريخ الدفع</div>
              <div className="text-xs font-bold text-slate-700">{payment.date || new Date().toISOString().split('T')[0]}</div>
            </div>
          </div>

          {/* Amount Highlight Box */}
          <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-emerald-800 block mb-1">
                المبلغ المسلم والمدفوع:
              </span>
              <div className="text-3xl font-black text-emerald-800 tracking-tight" dir="ltr">
                {amount.toLocaleString()} <span className="text-base font-bold text-emerald-600">د.ج</span>
              </div>
            </div>
            <div className="px-3.5 py-1.5 bg-emerald-600 text-white font-black text-xs rounded-xl shadow-xs">
              تم التسديد نقداً / تحويل
            </div>
          </div>

          {/* Details Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-200 border-b border-slate-200 bg-slate-50 p-3 font-bold text-slate-500">
              <div>المورد المستفيد</div>
              <div>رقم الهاتف / العنوان</div>
              <div>طريقة الدفع / الملاحظات</div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-200 p-4 font-bold text-slate-800">
              <div className="text-sm font-black text-slate-900">{supplierName}</div>
              <div className="text-xs text-slate-600">{supplier?.phone || supplier?.address || '-'}</div>
              <div className="text-xs text-slate-600">{payment.notes || 'تسديد دفعة على الحساب'}</div>
            </div>
          </div>

          {/* Accounting confirmation note */}
          <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
            <span className="font-bold text-slate-800">بيان السند: </span>
            تم بموجب هذا السند دفع المبلغ المذكور أعلاه لصالح المورد السيد/السادة ({supplierName})، وقد تم خصمها وتحديث الرصيد المستحق تلقائياً في دفاتر وسجلات الحسابات.
          </div>

          {/* Signatures & Stamps */}
          <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-3 gap-6 text-center text-xs">
            <div className="space-y-12">
              <span className="font-bold text-slate-600 block">أمين الصندوق / المحاسب</span>
              <div className="border-b border-slate-300 w-3/4 mx-auto pb-1 text-[10px] text-slate-400">التوقيع والختم</div>
            </div>

            <div className="space-y-12">
              <span className="font-bold text-slate-600 block">مصادقة الإدارة</span>
              <div className="border-b border-slate-300 w-3/4 mx-auto pb-1 text-[10px] text-slate-400">الاعتماد</div>
            </div>

            <div className="space-y-12">
              <span className="font-bold text-slate-600 block">توقيع واستلام المورد</span>
              <div className="border-b border-slate-300 w-3/4 mx-auto pb-1 text-[10px] text-slate-400">الاسم والتوقيع</div>
            </div>
          </div>

          {/* Footer print stamp */}
          <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-slate-100 flex justify-between items-center">
            <span>تم استخراج السند من النظام المحاسبي الآلي</span>
            <span>تاريخ وتوقيت الطباعة: {new Date().toLocaleDateString('ar-DZ')}</span>
          </div>

        </div>

      </div>
    </div>
  );
}
