import React from 'react';
import { X, Printer, Calendar, DollarSign, FileSpreadsheet, Users } from 'lucide-react';
import { Supplier } from '../../types';
import { triggerPrint } from '../../utils/printUtils';

interface SupplierPaymentsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: any[];
  suppliers: Supplier[];
  selectedSupplierId?: string;
  startDate?: string;
  endDate?: string;
  storeName?: string;
}

export function SupplierPaymentsReportModal({
  isOpen,
  onClose,
  payments,
  suppliers,
  selectedSupplierId,
  startDate,
  endDate,
  storeName = 'إدارة المخزون والمشتريات'
}: SupplierPaymentsReportModalProps) {
  if (!isOpen) return null;

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const totalAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const handlePrint = () => {
    triggerPrint({
      printableElementId: 'printable-payments-report',
      title: `سجل_مدفوعات_الموردين_${new Date().toISOString().split('T')[0]}`
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto border border-slate-200 animate-in fade-in zoom-in duration-200">
        
        {/* Actions Bar (Hidden in Print) */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">معاينة وطباعة كشف سجل مدفوعات الموردين</h3>
              <p className="text-xs text-slate-500 font-bold">
                {payments.length} دفعة مسجلة • إجمالي {totalAmount.toLocaleString()} د.ج
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>طباعة الكشف</span>
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
        <div id="printable-payments-report" className="p-8 sm:p-10 space-y-6 bg-white text-slate-800">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
            <div>
              <span className="text-xs font-black text-indigo-700 uppercase tracking-wider block mb-1">
                {storeName}
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                كشف وسجل مدفوعات الموردين
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                سجل دوري وتفصيلي للمبالغ المسددة للموردين لتسوية الديون وفواتير المشتريات
              </p>
            </div>

            <div className="text-left bg-slate-50 p-3 rounded-2xl border border-slate-200 min-w-[170px] text-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">تاريخ التقرير</div>
              <div className="font-black text-slate-800">{new Date().toISOString().split('T')[0]}</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">عدد الدفعات</div>
              <div className="font-black text-emerald-700">{payments.length} دفعة</div>
            </div>
          </div>

          {/* Filter summary metadata pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">المورد المحدد</span>
              <span className="text-slate-800 font-black">{selectedSupplier ? selectedSupplier.name : 'كافة الموردين'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">الفترة الزمنية</span>
              <span className="text-slate-800 font-black">
                {startDate || endDate ? `${startDate || 'البداية'} إلى ${endDate || 'الآن'}` : 'كافة الفترات'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">إجمالي المبالغ المسددة</span>
              <span className="text-emerald-700 font-black text-sm">{totalAmount.toLocaleString()} د.ج</span>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-black">
                <tr>
                  <th className="px-3 py-2.5 text-center w-12">#</th>
                  <th className="px-4 py-2.5">تاريخ الدفع</th>
                  <th className="px-4 py-2.5">اسم المورد</th>
                  <th className="px-4 py-2.5 text-left">المبلغ المدفوع (د.ج)</th>
                  <th className="px-4 py-2.5">طريقة الدفع / الملاحظات</th>
                  <th className="px-4 py-2.5 text-center w-28">التوقيع / الختم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.map((p, idx) => {
                  const s = suppliers.find(sup => sup.id === p.supplierId);
                  const sName = s?.name || p.supplierName || 'غير محدد';
                  return (
                    <tr key={p.id || idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-4 py-2 font-bold text-slate-700">{p.date}</td>
                      <td className="px-4 py-2 font-black text-slate-900">{sName}</td>
                      <td className="px-4 py-2 font-black text-emerald-700 text-left" dir="ltr">
                        +{Number(p.amount).toLocaleString()} د.ج
                      </td>
                      <td className="px-4 py-2 text-slate-600 font-medium">{p.notes || '-'}</td>
                      <td className="px-4 py-2 text-center text-slate-300">......</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-400 font-black text-slate-900">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-left">المجموع الكلي للمدفوعات:</td>
                  <td className="px-4 py-3 text-left text-emerald-800 text-sm font-black" dir="ltr">
                    +{totalAmount.toLocaleString()} د.ج
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-slate-500 font-normal text-[11px]">
                    تمت مطابقتها مع السجلات المحاسبية
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signatures */}
          <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-12">
              <span className="font-bold text-slate-600 block">إعداد وتدقيق المحاسب</span>
              <div className="border-b border-slate-300 w-1/2 mx-auto pb-1 text-[10px] text-slate-400">التوقيع</div>
            </div>
            <div className="space-y-12">
              <span className="font-bold text-slate-600 block">مصادقة واعتماد الإدارة العامة</span>
              <div className="border-b border-slate-300 w-1/2 mx-auto pb-1 text-[10px] text-slate-400">الختم والاعتماد</div>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-slate-100 flex justify-between items-center">
            <span>تم استخراج هذا الكشف آلياً وهو وثيقة محاسبية داخلية رسمية</span>
            <span>طُبع بتاريخ: {new Date().toLocaleDateString('ar-DZ')}</span>
          </div>

        </div>

      </div>
    </div>
  );
}
