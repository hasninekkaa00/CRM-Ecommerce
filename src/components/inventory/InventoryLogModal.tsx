import React, { useState, useMemo } from 'react';
import { X, Search, Filter, History, Calendar, FileSpreadsheet, ArrowUpRight, ArrowDownLeft, RefreshCw, Trash2, Plus, Box, ShieldCheck, AlertCircle } from 'lucide-react';
import { useStore } from '../../store';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { QuickStockAdjustModal } from './QuickStockAdjustModal';
import toast from 'react-hot-toast';

interface InventoryLogModalProps {
  onClose: () => void;
}

export function InventoryLogModal({ onClose }: InventoryLogModalProps) {
  const { inventoryMovements, inventoryProducts, deleteInventoryMovement } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showQuickAdjust, setShowQuickAdjust] = useState(false);
  const [deleteConfirmMov, setDeleteConfirmMov] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sorting and Filtering Movements
  const filteredMovements = useMemo(() => {
    let list = inventoryMovements || [];

    if (selectedProductFilter !== 'ALL') {
      list = list.filter(m => m.productId === selectedProductFilter);
    }

    if (typeFilter !== 'ALL') {
      if (typeFilter === 'ADDITION') list = list.filter(m => m.changeQty > 0);
      else if (typeFilter === 'REDUCTION') list = list.filter(m => m.changeQty < 0);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(m => 
        m.productName.toLowerCase().includes(q) ||
        (m.variationName && m.variationName.toLowerCase().includes(q)) ||
        (m.sku && m.sku.toLowerCase().includes(q)) ||
        (m.typeName && m.typeName.toLowerCase().includes(q)) ||
        (m.note && m.note.toLowerCase().includes(q))
      );
    }

    return list;
  }, [inventoryMovements, selectedProductFilter, typeFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = filteredMovements.length;
    const totalAdditions = filteredMovements
      .filter(m => m.changeQty > 0)
      .reduce((sum, m) => sum + m.changeQty, 0);
    const totalDeductions = filteredMovements
      .filter(m => m.changeQty < 0)
      .reduce((sum, m) => sum + Math.abs(m.changeQty), 0);

    return { totalCount, totalAdditions, totalDeductions };
  }, [filteredMovements]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) {
      toast.error('لا توجد حركات للتصدير');
      return;
    }

    const headers = ['التاريخ والوقت', 'اسم المنتج', 'النوع / العرض', 'رمز SKU', 'نوع الحركة', 'الكمية السابقة', 'التغيير', 'الكمية الجديدة', 'ملاحظات'];
    const rows = filteredMovements.map(m => {
      let formattedDate = m.date;
      try {
        formattedDate = format(parseISO(m.date), 'yyyy-MM-dd HH:mm', { locale: ar });
      } catch (e) {}

      return [
        `"${formattedDate}"`,
        `"${m.productName || ''}"`,
        `"${m.variationName || '-'}"`,
        `"${m.sku || '-'}"`,
        `"${m.typeName || ''}"`,
        m.oldStock,
        m.changeQty > 0 ? `+${m.changeQty}` : m.changeQty,
        m.newStock,
        `"${m.note || '-'}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `سجل_حركات_المخزن_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير سجل الحركات بنجاح!');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInventoryMovement(id);
      toast.success('تم حذف قيد الحركة من السجل');
    } catch (err) {
      toast.error('فشل في حذف حركة المخزن');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-slate-50 w-full max-w-6xl max-h-[85vh] sm:max-h-[88vh] my-auto flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-white px-6 py-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">سجل حركات وتعديلات المخزن</h2>
              <p className="text-xs text-slate-500 font-bold mt-1">
                تتبع كامل لكافة الإضافات، الخصومات، المشتريات والتسويات بالتاريخ والوقت
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => setShowQuickAdjust(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> إضافة / تعديل مخزون
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> تصدير اكسل (CSV)
            </button>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400">إجمالي الحركات المسجلة</div>
              <div className="text-lg font-black text-slate-800">{stats.totalCount} حركات</div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-600">إجمالي الكميات المضافة (+)</div>
              <div className="text-lg font-black text-emerald-700">+{stats.totalAdditions} قطعة</div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-rose-50/60 p-3 rounded-2xl border border-rose-100">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-rose-600">إجمالي الكميات المخصومة (-)</div>
              <div className="text-lg font-black text-rose-700">-{stats.totalDeductions} قطعة</div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3 shrink-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="البحث باسم المنتج، SKU، أو الملاحظات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Product Filter */}
          <div className="min-w-[180px]">
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">جميع المنتجات</option>
              {inventoryProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="min-w-[140px]">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">جميع العمليات</option>
              <option value="ADDITION">إضافات فقط (+)</option>
              <option value="REDUCTION">خصومات فقط (-)</option>
            </select>
          </div>
        </div>

        {/* Movements Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredMovements.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <Box className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-800 mb-1">لا توجد حركات مسجلة</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                تظهر هنا جميع حركات إضافة أو تعديل أو خصم المخزون بالتاريخ والوقت. يمكنك بدء إضافة حركة جديدة يدوياً.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                  <tr>
                    <th className="px-5 py-3.5">التاريخ والوقت</th>
                    <th className="px-5 py-3.5">المنتج / النوع</th>
                    <th className="px-5 py-3.5 text-center">رمز SKU</th>
                    <th className="px-5 py-3.5">نوع الحركة والسبب</th>
                    <th className="px-5 py-3.5 text-center">قبل</th>
                    <th className="px-5 py-3.5 text-center">التغيير</th>
                    <th className="px-5 py-3.5 text-center">الجديد</th>
                    <th className="px-5 py-3.5 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map((m, idx) => {
                    let formattedDate = m.date;
                    try {
                      formattedDate = format(parseISO(m.date), 'yyyy-MM-dd | hh:mm a', { locale: ar });
                    } catch (e) {}

                    const isAddition = m.changeQty > 0;

                    return (
                      <tr key={`${m.id}_${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-[11px] font-bold text-slate-500 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{m.productName}</div>
                          {m.variationName && (
                            <div className="text-[11px] font-semibold text-indigo-600 mt-0.5">
                              النوع: {m.variationName}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {m.sku ? (
                            <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                              {m.sku}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                            isAddition
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {m.typeName}
                          </span>
                          {m.note && (
                            <div className="text-[11px] text-slate-400 mt-1 max-w-xs truncate" title={m.note}>
                              {m.note}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold text-slate-500">
                          {m.oldStock}
                        </td>
                        <td className="px-5 py-3.5 text-center font-black">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black inline-block ${
                            isAddition ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isAddition ? `+${m.changeQty}` : m.changeQty}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-black text-slate-900 text-sm">
                          {m.newStock}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => setDeleteConfirmMov(m)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="حذف الحركة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal for Quick Adjust if opened from log */}
        {showQuickAdjust && (
          <QuickStockAdjustModal onClose={() => setShowQuickAdjust(false)} />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmMov && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">تأكيد حذف حركة المخزن</h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">عملية غير قابلة للتراجع</p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 text-xs font-bold text-rose-900 space-y-2 leading-relaxed">
              <p>هل أنت متأكد من حذف هذه الحركة من السجل؟</p>
              <div className="bg-white/90 p-3 rounded-xl border border-rose-100 text-slate-800 font-normal space-y-1 text-xs">
                <div><strong>المنتج:</strong> {deleteConfirmMov.productName}</div>
                {deleteConfirmMov.variationName && <div><strong>النوع:</strong> {deleteConfirmMov.variationName}</div>}
                <div><strong>نوع الحركة:</strong> {deleteConfirmMov.typeName}</div>
                <div><strong>مقدار التغيير:</strong> {deleteConfirmMov.changeQty > 0 ? `+${deleteConfirmMov.changeQty}` : deleteConfirmMov.changeQty} قطعة</div>
              </div>
              <p className="text-[11px] text-rose-700 font-bold">ملاحظة: سيتم إلغاء أثر هذه الحركة وتحديث رصيد المخزن تلقائياً.</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteInventoryMovement(deleteConfirmMov.id);
                    toast.success('تم حذف الحركة وإلغاء أثرها من المخزن بنجاح');
                    setDeleteConfirmMov(null);
                  } catch (e) {
                    toast.error('حدث خطأ أثناء حذف الحركة');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                تأكيد الحذف
              </button>
              <button
                disabled={isDeleting}
                onClick={() => setDeleteConfirmMov(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
