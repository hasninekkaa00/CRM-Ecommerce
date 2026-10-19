import React, { useState, useMemo } from 'react';
import { X, Printer, Download, User, Calendar, ArrowUpRight, ArrowDownLeft, DollarSign, Percent, Phone, Filter, Trash2, AlertCircle } from 'lucide-react';
import { useStore } from '../../store';
import toast from 'react-hot-toast';
import { Partner, PartnerTransaction } from '../../types';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { triggerPrint } from '../../utils/printUtils';

interface PartnerStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
  transactions: PartnerTransaction[];
  onOpenSettle?: (partnerId: string, amount: number, type: 'contribution'|'withdrawal', description?: string) => void;
}

export function PartnerStatementModal({
  isOpen,
  onClose,
  partner,
  transactions,
  onOpenSettle
}: PartnerStatementModalProps) {
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_month' | 'custom'>(() => {
    return (localStorage.getItem('partner_dateFilter') as any) || 'all';
  });

  React.useEffect(() => {
    localStorage.setItem('partner_dateFilter', dateFilter);
  }, [dateFilter]);
  const { deletePartnerTransaction } = useStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter transactions for this partner
  const partnerTxList = useMemo(() => {
    if (!partner) return [];
    // Transactions where this partner is either the primary partner OR target of settlement
    const list = transactions.filter(t => t.partnerId === partner.id || t.targetPartnerId === partner.id);

    return list.filter(t => {
      if (dateFilter === 'this_month') {
        const now = new Date();
        const currentMonthPrefix = format(now, 'yyyy-MM');
        return t.date.startsWith(currentMonthPrefix);
      }
      if (dateFilter === 'last_month') {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthPrefix = format(lastMonth, 'yyyy-MM');
        return t.date.startsWith(lastMonthPrefix);
      }
      if (dateFilter === 'custom') {
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, partner, dateFilter, startDate, endDate]);

  if (!isOpen || !partner) return null;

  // Compute metrics for this partner
  let runningBalance = partner.initialCapital || 0;
  let totalContributed = partner.initialCapital || 0;
  let totalWithdrawn = 0;

  const enrichedRows = partnerTxList.map(t => {
    let debit = 0; // سحب (عليه)
    let credit = 0; // مساهمة (له)
    let typeName = '';

    if (t.type === 'partner_settlement') {
      if (t.partnerId === partner.id) {
        // دفع لشريك آخر = يعتبر دفع من ماله (مساهمة)
        credit = t.amount;
        typeName = `تسوية مدفوعة إلى ${t.targetPartnerName || 'الشريك'}`;
      } else {
        // استلم من شريك آخر = يعتبر استلام / سحب
        debit = t.amount;
        typeName = `تسوية مستلمة من ${t.partnerName || 'الشريك'}`;
      }
    } else if (t.type === 'withdrawal') {
      debit = t.amount;
      typeName = 'سحب شخصي / أرباح';
    } else {
      // contribution, ad_spend, goods_purchase, shipping_expense, operational_expense, other
      credit = t.amount;
      if (t.type === 'contribution') typeName = 'ضخ رأس مال';
      else if (t.type === 'ad_spend') typeName = 'إعلانات ممولة';
      else if (t.type === 'goods_purchase') typeName = 'شراء بضاعة';
      else if (t.type === 'shipping_expense') typeName = 'مصاريف شحن';
      else if (t.type === 'operational_expense') typeName = 'مصاريف تشغيلية';
      else typeName = 'مصروف عام';
    }

    totalContributed += credit;
    totalWithdrawn += debit;
    runningBalance += (credit - debit);

    return {
      ...t,
      credit,
      debit,
      typeName,
      balanceAfter: runningBalance
    };
  });

  const netBalance = totalContributed - totalWithdrawn;

  const handlePrint = () => {
    triggerPrint({ printableElementId: 'printable-partner-statement', title: `كشف_حساب_${partner?.name || 'الشريك'}` });
  };

  const handleExportExcel = () => {
    const dataToExport = enrichedRows.map((r, i) => ({
      '#': i + 1,
      'التاريخ': r.date,
      'نوع العملية': r.typeName,
      'البيان والوصف': r.description,
      'طريقة الدفع': r.paymentMethod || 'كاش',
      'له (مساهمة / دفع) د.ج': r.credit,
      'عليه (مسحوبات / أخذ) د.ج': r.debit,
      'الرصيد التراكمي د.ج': r.balanceAfter,
      'ملاحظات': r.notes || ''
    }));

    // Add summary row
    dataToExport.push({
      '#': 0 as any,
      'التاريخ': 'الإجمالي',
      'نوع العملية': '',
      'البيان والوصف': '',
      'طريقة الدفع': '',
      'له (مساهمة / دفع) د.ج': totalContributed,
      'عليه (مسحوبات / أخذ) د.ج': totalWithdrawn,
      'الرصيد التراكمي د.ج': netBalance,
      'ملاحظات': netBalance >= 0 ? `له في المشروع ${netBalance.toLocaleString()} د.ج` : `عليه للمشروع ${Math.abs(netBalance).toLocaleString()} د.ج`
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `كشف_${partner.name}`);
    XLSX.writeFile(workbook, `كشف_حساب_${partner.name}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div id="printable-partner-statement" className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-xs">
              {partner.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-lg">كشف حساب الشريك: {partner.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold">
                  حصة {partner.sharePercentage || 50}%
                </span>
              </div>
              <p className="text-xs text-slate-500">
                سجل تفصيلي بكافة المساهمات، المصاريف المدفوعة، والمسحوبات الشخصية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              title="تصدير Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">تصدير Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
              title="طباعة كشف الحساب"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-600">الفترة الزمنية:</span>
            <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 text-xs">
              <button
                onClick={() => setDateFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${dateFilter === 'all' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                الكل
              </button>
              <button
                onClick={() => setDateFilter('this_month')}
                className={`px-2.5 py-1 rounded-md transition-colors ${dateFilter === 'this_month' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                هذا الشهر
              </button>
              <button
                onClick={() => setDateFilter('last_month')}
                className={`px-2.5 py-1 rounded-md transition-colors ${dateFilter === 'last_month' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                الشهر السابق
              </button>
              <button
                onClick={() => setDateFilter('custom')}
                className={`px-2.5 py-1 rounded-md transition-colors ${dateFilter === 'custom' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                مخصص
              </button>
            </div>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <span>من:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md font-mono"
              />
              <span>إلى:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md font-mono"
              />
            </div>
          )}

          {partner.phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono" dir="ltr">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {partner.phone}
            </div>
          )}
        </div>

        {/* Printable Only Header */}
        <div className="hidden print:block p-6 pb-4 border-b-2 border-slate-900 text-center">
          <h1 className="text-2xl font-black text-slate-900">كشف حساب الشريك: {partner.name}</h1>
          <div className="text-xs font-bold text-slate-600 flex justify-center gap-6 mt-1">
            <span>نسبة الحصة: {partner.sharePercentage || 50}%</span>
            <span>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-DZ')}</span>
            <span>الفترة: {dateFilter === 'this_month' ? 'هذا الشهر' : dateFilter === 'last_month' ? 'الشهر السابق' : dateFilter === 'custom' ? `من ${startDate} إلى ${endDate}` : 'كافة الفترات'}</span>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-6 shrink-0 bg-slate-50/50 border-b border-slate-100">
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800 mb-1">
              <span>إجمالي ما ساهم ودفعه (له)</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black font-mono text-emerald-700">
              {totalContributed.toLocaleString()} <span className="text-xs font-normal">د.ج</span>
            </div>
            <div className="text-[11px] text-emerald-600 mt-1">
              رأس مال + مصاريف إعلانات وبضاعة
            </div>
          </div>

          <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-rose-800 mb-1">
              <span>إجمالي ما أخذه وسحبه (عليه)</span>
              <ArrowDownLeft className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl font-black font-mono text-rose-700">
              {totalWithdrawn.toLocaleString()} <span className="text-xs font-normal">د.ج</span>
            </div>
            <div className="text-[11px] text-rose-600 mt-1">
              مسحوبات شخصية وأرباح مستلمة
            </div>
          </div>

          <div className={`rounded-xl p-3.5 border ${
            netBalance >= 0 
              ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900' 
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span>الرصيد الصافي المتبقي له</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-xl font-black font-mono">
              {Math.abs(netBalance).toLocaleString()} <span className="text-xs font-normal">د.ج</span>
            </div>
            <div className="text-[11px] font-semibold mt-1">
              {netBalance >= 0 
                ? '✅ له في ذمة المشروع / الشركاء' 
                : '⚠️ عليه دفع هذا المبلغ لتسوية حسابه'}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {enrichedRows.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
              <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">لا توجد حركات مسجلة لهذا الشريك في الفترة المحددة</p>
              <p className="text-xs text-slate-400 mt-1">يمكنك إضافة دفعات ومصاهمات من الشاشة الرئيسية</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-3">التاريخ</th>
                    <th className="py-3 px-3">النوع</th>
                    <th className="py-3 px-3">البيان / الوصف</th>
                    <th className="py-3 px-3">الوسيلة</th>
                    <th className="py-3 px-3 text-emerald-700">له (مساهمة)</th>
                    <th className="py-3 px-3 text-rose-700">عليه (سحب)</th>
                    <th className="py-3 px-3 text-slate-900 font-black">الرصيد</th>
                    <th className="py-3 px-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(partner.initialCapital || 0) > 0 && (
                    <tr className="bg-slate-50/50 font-medium">
                      <td className="py-2.5 px-3 font-mono text-slate-400">-</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                          رأس مال افتتاحي
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">رأس المال التأسيسي للمشروع</td>
                      <td className="py-2.5 px-3 text-slate-400">تأسيس</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                        {partner.initialCapital.toLocaleString()} د.ج
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">-</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                        {partner.initialCapital.toLocaleString()} د.ج
                      </td>
                      <td></td>
                    </tr>
                  )}
                  {enrichedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{r.date}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          r.credit > 0 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {r.typeName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{r.description}</div>
                        {r.notes && (
                          <div className="text-[10px] text-slate-400">{r.notes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{r.paymentMethod || 'كاش'}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {r.credit > 0 ? `${r.credit.toLocaleString()} د.ج` : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-700 whitespace-nowrap">
                        {r.debit > 0 ? `${r.debit.toLocaleString()} د.ج` : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className={r.balanceAfter >= 0 ? 'text-indigo-700' : 'text-amber-700'}>
                          {r.balanceAfter.toLocaleString()} د.ج
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center flex items-center justify-center gap-1">
                        {onOpenSettle && r.balanceAfter !== 0 && (
                          <button
                            onClick={() => {
                              const amountToSettle = r.credit > 0 ? r.credit : r.debit;
                              const settleType = r.credit > 0 ? 'withdrawal' : 'contribution';
                              const desc = `تسوية: ${r.description || r.typeName}`;
                              onOpenSettle(partner.id, amountToSettle, settleType, desc);
                            }}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[10px] font-bold transition-colors"
                            title="تسوية هذه العملية"
                          >
                            تسوية
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="حذف الدفعة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t border-slate-200 text-slate-900">
                    <td colSpan={4} className="py-3 px-3 text-left">المجموع الإجمالي:</td>
                    <td className="py-3 px-3 font-mono text-emerald-700">{totalContributed.toLocaleString()} د.ج</td>
                    <td className="py-3 px-3 font-mono text-rose-700">{totalWithdrawn.toLocaleString()} د.ج</td>
                    <td className="py-3 px-3 font-mono text-indigo-800 font-black">{netBalance.toLocaleString()} د.ج</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">تأكيد حذف الدفعة</h3>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  هل أنت متأكد من حذف هذه الدفعة / الحركة المالية؟ سيؤثر هذا على رصيد الشريك، ولا يمكن التراجع عن هذا الإجراء.
                </p>
                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={async () => {
                      if (confirmDeleteId) {
                        try {
                          await deletePartnerTransaction(confirmDeleteId);
                          toast.success('تم حذف الدفعة وتحديث الرصيد بنجاح');
                        } catch (e) {
                          toast.error('حدث خطأ أثناء الحذف');
                        }
                      }
                      setConfirmDeleteId(null);
                    }}
                    className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    نعم، احذف
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            تاريخ استخراج الكشف: <span className="font-mono text-slate-700">{format(new Date(), 'yyyy-MM-dd HH:mm')}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
