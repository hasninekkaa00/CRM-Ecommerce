import React from 'react';
import { ConfirmerInvoice } from '../../types';
import { X, Printer, CheckCircle2, Building, Calendar, User, FileText, Download } from 'lucide-react';

interface ConfirmerInvoicePrintViewProps {
  invoice: ConfirmerInvoice;
  onClose: () => void;
}

export const ConfirmerInvoicePrintView: React.FC<ConfirmerInvoicePrintViewProps> = ({
  invoice,
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Actions Bar (Excluded from Print) */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">معاينة وطباعة الفاتورة</span>
            <span className="font-mono text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold">
              {invoice.invoiceNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الفاتورة</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div id="printable-confirmer-invoice" className="p-8 sm:p-10 overflow-y-auto space-y-6 text-slate-800 text-xs sm:text-sm bg-white">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6">
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                فاتورة تصفية مستحقات مؤكد
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">
                سند محاسبي رسمي لتسوية عمولات التأكيد
              </div>
              <div className="text-xs font-mono font-bold text-indigo-700 mt-2">
                رقم الفاتورة: {invoice.invoiceNumber}
              </div>
            </div>

            <div className="text-left space-y-1">
              <div className="text-sm font-bold text-slate-800">
                تاريخ الإصدار: {new Date(invoice.createdAt).toLocaleDateString('ar-DZ')}
              </div>
              <div className="text-xs text-slate-500">
                الفترة: من {invoice.periodFrom} إلى {invoice.periodTo}
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                {invoice.status === 'paid' ? 'خالص / مدفوع' : 'معلق في انتظار التحويل'}
              </div>
            </div>
          </div>

          {/* Confirmer Info & Store Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-1">المؤكد المستفيد:</span>
              <div className="text-base font-bold text-slate-900">{invoice.confirmerName}</div>
              <div className="text-xs text-slate-500">{invoice.confirmerEmail || 'مؤكد في النظام'}</div>
            </div>

            <div className="text-left">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">طريقة السداد:</span>
              <div className="text-sm font-bold text-slate-800">{invoice.paymentMethod || 'بريدي موب'}</div>
              <div className="text-xs text-slate-500">الطلبيات المشمولة: {invoice.includedOrderIds?.length || 0} طلبية</div>
            </div>
          </div>

          {/* Operations & Performance Summary */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 bg-slate-100 rounded-lg">
              <div className="text-[11px] text-slate-500 font-semibold">المسندة</div>
              <div className="text-base font-bold text-slate-800">{invoice.stats?.totalAssigned || 0}</div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-[11px] text-emerald-700 font-semibold">المؤكدة</div>
              <div className="text-base font-bold text-emerald-700">{invoice.stats?.totalConfirmed || 0}</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-[11px] text-blue-700 font-semibold">المستلمة (Livré)</div>
              <div className="text-base font-bold text-blue-700">{invoice.stats?.totalDelivered || 0}</div>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
              <div className="text-[11px] text-rose-700 font-semibold">الملغاة</div>
              <div className="text-base font-bold text-rose-700">{invoice.stats?.totalCanceled || 0}</div>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-right border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">البيان</th>
                  <th className="py-2.5 px-3 text-center">العدد</th>
                  <th className="py-2.5 px-3 text-center">سعر الوحدة</th>
                  <th className="py-2.5 px-3 text-center">المجموع الجزئي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.commissionType === 'per_confirmed' && (
                  <tr>
                    <td className="py-2.5 px-3 font-medium">عمولة الطلبيات المؤكدة بنجاح</td>
                    <td className="py-2.5 px-3 text-center font-bold">{invoice.stats?.totalConfirmed || 0}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{invoice.rates?.ratePerConfirmed || 0} دج</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                      {((invoice.stats?.totalConfirmed || 0) * (invoice.rates?.ratePerConfirmed || 0)).toLocaleString()} دج
                    </td>
                  </tr>
                )}

                {invoice.commissionType === 'per_delivered' && (
                  <tr>
                    <td className="py-2.5 px-3 font-medium">عمولة الطلبيات المستلمة والمحصلة (Livré)</td>
                    <td className="py-2.5 px-3 text-center font-bold">{invoice.stats?.totalDelivered || 0}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{invoice.rates?.ratePerDelivered || 0} دج</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                      {((invoice.stats?.totalDelivered || 0) * (invoice.rates?.ratePerDelivered || 0)).toLocaleString()} دج
                    </td>
                  </tr>
                )}

                {invoice.commissionType === 'per_assigned' && (
                  <tr>
                    <td className="py-2.5 px-3 font-medium">عمولة الطلبيات المسندة</td>
                    <td className="py-2.5 px-3 text-center font-bold">{invoice.stats?.totalAssigned || 0}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{invoice.rates?.ratePerAssigned || 0} دج</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                      {((invoice.stats?.totalAssigned || 0) * (invoice.rates?.ratePerAssigned || 0)).toLocaleString()} دج
                    </td>
                  </tr>
                )}

                {invoice.commissionType === 'hybrid' && (
                  <>
                    <tr>
                      <td className="py-2.5 px-3 font-medium">عمولة التأكيد</td>
                      <td className="py-2.5 px-3 text-center font-bold">{invoice.stats?.totalConfirmed || 0}</td>
                      <td className="py-2.5 px-3 text-center font-medium">{invoice.rates?.ratePerConfirmed || 0} دج</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {((invoice.stats?.totalConfirmed || 0) * (invoice.rates?.ratePerConfirmed || 0)).toLocaleString()} دج
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium">مكافأة الاستلام والتسليم</td>
                      <td className="py-2.5 px-3 text-center font-bold">{invoice.stats?.totalDelivered || 0}</td>
                      <td className="py-2.5 px-3 text-center font-medium">{invoice.rates?.ratePerDelivered || 0} دج</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {((invoice.stats?.totalDelivered || 0) * (invoice.rates?.ratePerDelivered || 0)).toLocaleString()} دج
                      </td>
                    </tr>
                  </>
                )}

                {invoice.bonusAmount > 0 && (
                  <tr className="bg-emerald-50/50 text-emerald-800">
                    <td className="py-2.5 px-3 font-bold">+ مكافأة إضافية ({invoice.bonusReason || 'بونص أداء'})</td>
                    <td className="py-2.5 px-3 text-center">-</td>
                    <td className="py-2.5 px-3 text-center">-</td>
                    <td className="py-2.5 px-3 text-center font-bold">+{invoice.bonusAmount.toLocaleString()} دج</td>
                  </tr>
                )}

                {invoice.deductionAmount > 0 && (
                  <tr className="bg-rose-50/50 text-rose-800">
                    <td className="py-2.5 px-3 font-bold">- خصومات / غرامات ({invoice.deductionReason || 'خصم'})</td>
                    <td className="py-2.5 px-3 text-center">-</td>
                    <td className="py-2.5 px-3 text-center">-</td>
                    <td className="py-2.5 px-3 text-center font-bold">-{invoice.deductionAmount.toLocaleString()} دج</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-sm">
                  <td colSpan={3} className="py-3 px-4 text-right">
                    المبلغ الإجمالي الصافي المستحق الدفع:
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-400 font-black text-base">
                    {invoice.finalTotal?.toLocaleString()} دج
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              <span className="font-bold block mb-0.5">ملاحظات الفاتورة:</span>
              <span>{invoice.notes}</span>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-center">
            <div>
              <div className="text-xs text-slate-500 mb-8">حررت بواسطة الإدارة</div>
              <div className="text-xs font-bold text-slate-800">{invoice.createdBy || 'المدير المسؤول'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-8">توقيع واستلام المؤكد</div>
              <div className="text-xs font-bold text-slate-800">{invoice.confirmerName}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
