import React, { useState } from 'react';
import { useStore } from '../../store';
import { Plus, Trash2, Check, X, FileText, Search, Link2, Download, Building, DollarSign, Calendar, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { arDZ } from 'date-fns/locale';

export function ShippingInvoices() {
  const { shippingInvoices, addShippingInvoice, updateShippingInvoice, deleteShippingInvoice, settings, suppliers = [] } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    attachmentUrl: '',
    notes: '',
    linkedSupplierId: '',
    linkedSupplierAmount: '',
  });

  const [searchTerm, setSearchTerm] = useState('');

  const connectedCompanies = settings?.shippingIntegrations?.filter(i => i.isActive).map(i => i.name) || [];
  const companies = Array.from(new Set([...connectedCompanies, ...(settings?.deliveryCompanies || [])]));

  const handleAddStart = () => {
    setIsAdding(true);
    setEditingInvoiceId(null);
    setFormData({
      companyName: companies[0] || '',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      attachmentUrl: '',
      notes: '',
    linkedSupplierId: '',
    linkedSupplierAmount: '',
  });
  };

  const handleEditStart = (inv: any) => {
    setIsAdding(true);
    setEditingInvoiceId(inv.id);
    setFormData({
      companyName: inv.companyName || '',
      amount: (inv.amount ?? '').toString(),
      date: inv.date || '',
      attachmentUrl: inv.attachmentUrl || '',
      notes: inv.notes || '',
      linkedSupplierId: inv.linkedSupplierId || '',
      linkedSupplierAmount: inv.linkedSupplierAmount ? inv.linkedSupplierAmount.toString() : '',
    });
  };

  const handleSave = async () => {
    if (!formData.companyName || !formData.amount || !formData.date) return;
    
    setIsSubmitting(true);
    try {
      if (editingInvoiceId && updateShippingInvoice) {
        await updateShippingInvoice(editingInvoiceId, {
          companyName: formData.companyName,
          amount: Number(formData.amount),
          date: formData.date,
          attachmentUrl: formData.attachmentUrl,
          notes: formData.notes,
          linkedSupplierId: formData.linkedSupplierId || undefined,
          linkedSupplierAmount: formData.linkedSupplierAmount ? Number(formData.linkedSupplierAmount) : undefined,
        });
      } else {
        await addShippingInvoice({
          id: `ship_inv_${Date.now()}`,
          companyName: formData.companyName,
          amount: Number(formData.amount),
          date: formData.date,
          attachmentUrl: formData.attachmentUrl,
          notes: formData.notes,
          linkedSupplierId: formData.linkedSupplierId || undefined,
          linkedSupplierAmount: formData.linkedSupplierAmount ? Number(formData.linkedSupplierAmount) : undefined,
          createdAt: new Date().toISOString()
        });
      }
      setIsAdding(false);
      setEditingInvoiceId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = shippingInvoices.filter(i => 
    i.companyName.includes(searchTerm) || 
    (i.notes && i.notes.includes(searchTerm)) ||
    i.amount.toString().includes(searchTerm)
  );

  const totalAmount = filteredInvoices.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="p-6 text-right max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            فواتير شركات التوصيل
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            سجل المبالغ المالية المحصلة من شركات الشحن والفواتير المستلمة منهم.
          </p>
        </div>
        {!isAdding && (
          <button 
            onClick={handleAddStart}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة فاتورة/مبلغ
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">إجمالي المبالغ المستلمة</p>
              <h3 className="text-2xl font-black text-slate-800">{totalAmount.toLocaleString()} د.ج</h3>
            </div>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">عدد الفواتير</p>
              <h3 className="text-2xl font-black text-slate-800">{filteredInvoices.length}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Add Form */}
        {isAdding && (
          <div className="bg-white border text-right border-emerald-200 rounded-xl p-6 shadow-sm mb-6 max-w-3xl animate-fadeIn">
            <h3 className="text-lg font-black text-slate-800 mb-4 border-b pb-2">
              {editingInvoiceId ? 'تعديل الفاتورة' : 'تفاصيل الفاتورة / المبلغ المستلم'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">شركة الشحن *</label>
                <select
                  value={formData.companyName ?? ''}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">-- اختر شركة --</option>
                  {companies.map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                  <option value="شركة أخرى">شركة أخرى...</option>
                </select>
                {formData.companyName === 'شركة أخرى' && (
                  <input
                    type="text"
                    placeholder="اسم الشركة"
                    className="w-full mt-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">المبلغ المستلم (د.ج) *</label>
                <input
                  type="number"
                  value={formData.amount ?? ''}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">تاريخ الاستلام / الفاتورة *</label>
                <input
                  type="date"
                  value={formData.date ?? ''}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-right"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">رابط الفاتورة المرفقة (اختياري)</label>
                <input
                  type="url"
                  value={formData.attachmentUrl ?? ''}
                  onChange={(e) => setFormData({...formData, attachmentUrl: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left font-mono"
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">ملاحظات إضافية</label>
                <textarea
                  value={formData.notes ?? ''}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 h-20"
                  placeholder="رقم التحويل، تفاصيل الحساب، إلخ..."
                ></textarea>
              </div>
              <div className="md:col-span-2 mt-2 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="w-5 h-5 text-indigo-500" />
                  <h4 className="font-bold text-slate-800 text-sm">ربط الدفعة بمورد في قسم الديون (لتسوية الكريدي)</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">المورد المستفيد</label>
                    <select
                      value={formData.linkedSupplierId ?? ''}
                      onChange={(e) => setFormData({...formData, linkedSupplierId: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">-- بدون ربط --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">المبلغ الموجه للمورد (د.ج)</label>
                    <input
                      type="number"
                      value={formData.linkedSupplierAmount ?? ''}
                      onChange={(e) => setFormData({...formData, linkedSupplierAmount: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-50 disabled:bg-slate-100"
                      placeholder="0"
                      min="0"
                      disabled={!formData.linkedSupplierId}
                    />
                    <p className="text-xs text-slate-500 mt-1">سيتم خصمه من ديونه الكلية / تسويات الكريدي.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={isSubmitting || !formData.companyName || !formData.amount || !formData.date}
                className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {isSubmitting ? 'جاري الحفظ...' : editingInvoiceId ? 'تعديل الفاتورة' : 'حفظ'}
              </button>
              <button
                onClick={() => { setIsAdding(false); setEditingInvoiceId(null); }}
                disabled={isSubmitting}
                className="bg-slate-100 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">قائمة الفواتير</h3>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث في الفواتير..."
                className="pl-4 pr-10 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-3">التاريخ</th>
                  <th className="px-6 py-3">الشركة</th>
                  <th className="px-6 py-3">المبلغ المستلم</th>
                  <th className="px-6 py-3">ملاحظات</th>
                  <th className="px-6 py-3 text-center">المرفق</th>
                  <th className="px-6 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-slate-200 mb-2" />
                        <p className="font-bold">لا توجد فواتير مطابقة لبحثك</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          <span className="font-medium" dir="ltr">
                            {format(parseISO(inv.date), 'dd MMM yyyy', { locale: arDZ })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <Building className="w-4 h-4 text-slate-400" />
                          {inv.companyName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                          {inv.amount.toLocaleString()} د.ج
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-600 max-w-xs truncate" title={inv.notes}>
                          {inv.notes || '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {inv.attachmentUrl ? (
                          <a 
                            href={inv.attachmentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="عرض الفاتورة"
                          >
                            <Link2 className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditStart(inv)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
                                deleteShippingInvoice(inv.id);
                              }
                            }}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
