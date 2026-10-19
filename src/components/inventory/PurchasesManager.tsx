import { ConsignmentSettlementsTab } from './ConsignmentSettlementsTab';
import React, { useState } from 'react';
import { Plus, Search, Users, FileText, Trash2, Edit2, DollarSign, PackagePlus, Eye, X, Calculator, CreditCard, History, CheckCircle2, ArrowUpRight, ArrowDownLeft, Filter, Printer } from 'lucide-react';
import { useStore } from '../../store';
import { Supplier, PurchaseInvoice, PurchaseInvoiceItem, SupplierPayment } from '../../types';
import toast from 'react-hot-toast';
import { checkSupplierDeletionIntegrity, checkPurchaseInvoiceDeletionIntegrity, IntegrityCheckResult } from '../../utils/dataIntegrity';
import { IntegrityProtectionModal } from '../common/IntegrityProtectionModal';
import { triggerPrint } from '../../utils/printUtils';
import { SupplierPaymentVoucherModal } from './SupplierPaymentVoucherModal';
import { SupplierPaymentsReportModal } from './SupplierPaymentsReportModal';

export function PurchasesManager() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'suppliers' | 'payments' | 'consignments'>('invoices');

  const { suppliers, purchaseInvoices, supplierPayments, inventoryProducts, orders, settings, addSupplier, updateSupplier, deleteSupplier, addPurchaseInvoice, updatePurchaseInvoice, deletePurchaseInvoice, addSupplierPayment, deleteSupplierPayment, recordStockAdjustment, createConsignmentSettlement } = useStore();

  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  const [isAddingInvoice, setIsAddingInvoice] = useState(false);

  // Data Integrity state
  const [integrityBlockResult, setIntegrityBlockResult] = useState<IntegrityCheckResult | null>(null);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);

  const handleShowIntegrityBlock = (result: IntegrityCheckResult) => {
    setIntegrityBlockResult(result);
    setShowIntegrityModal(true);
  };

  // حالة مودال تأكيد الحذف بدلاً من window.confirm
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // حسابات الداشبورد الإجمالية
  const totalPurchases = (purchaseInvoices || []).reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const totalPayments = (supplierPayments || []).reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
  const totalDebt = totalPurchases - totalPayments;

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800">إدارة الموردين والمشتريات</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">متابعة فواتير الشراء، مدفوعات الموردين، كشوفات الحساب وحسابات الديون الدقيقة.</p>
        </div>
        <div className="flex bg-slate-200 p-1 rounded-xl print:hidden">
           <button
             onClick={() => setActiveTab('invoices')}
             className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors ${activeTab === 'invoices' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
           >
             <FileText className="w-4 h-4" />
             فواتير الشراء ({purchaseInvoices.length})
           </button>
           <button
             onClick={() => setActiveTab('payments')}
             className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors ${activeTab === 'payments' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
           >
             <DollarSign className="w-4 h-4" />
             سجل المدفوعات ({supplierPayments.length})
           </button>
           <button
             onClick={() => setActiveTab('consignments')}
             className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors ${activeTab === 'consignments' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
           >
             <Calculator className="w-4 h-4" />
             تسويات الكريدي
           </button>
           <button
             onClick={() => setActiveTab('suppliers')}
             className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors ${activeTab === 'suppliers' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
           >
             <Users className="w-4 h-4" />
             الموردين ({suppliers.length})
           </button>
        </div>
      </div>

      {/* لوحة تحكم سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 print:hidden">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
             <Calculator className="w-6 h-6" />
           </div>
           <div>
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">إجمالي المشتريات (الفواتير)</div>
             <div className="text-2xl font-black text-slate-800">{totalPurchases.toLocaleString()} <span className="text-xs font-bold">د.ج</span></div>
           </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
             <CreditCard className="w-6 h-6" />
           </div>
           <div>
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">إجمالي المدفوعات للموردين</div>
             <div className="text-2xl font-black text-emerald-600">{totalPayments.toLocaleString()} <span className="text-xs font-bold">د.ج</span></div>
           </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
           {totalDebt > 0 && <div className="absolute top-0 right-0 w-1.5 h-full bg-rose-500"></div>}
           <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${totalDebt > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
             <DollarSign className="w-6 h-6" />
           </div>
           <div>
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">إجمالي الديون المتبقية</div>
             <div className={`text-2xl font-black ${totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{totalDebt.toLocaleString()} <span className="text-xs font-bold">د.ج</span></div>
           </div>
        </div>
      </div>

      {activeTab === 'consignments' && (
         <ConsignmentSettlementsTab 
            suppliers={suppliers}
            orders={orders}
            purchaseInvoices={purchaseInvoices}
            inventoryProducts={inventoryProducts}
            settings={settings}
            createConsignmentSettlement={createConsignmentSettlement}
            onSwitchToInvoices={() => setActiveTab('invoices')}
            shippingInvoices={useStore.getState().shippingInvoices || []}
            supplierPayments={supplierPayments}
            addSupplierPayment={addSupplierPayment}
         />
      )}

      {activeTab === 'suppliers' && (
         <SuppliersTab 
            suppliers={suppliers} 
            purchaseInvoices={purchaseInvoices}
            supplierPayments={supplierPayments}
            addSupplier={addSupplier} 
            updateSupplier={updateSupplier} 
            deleteSupplier={deleteSupplier}
            addSupplierPayment={addSupplierPayment}
            isAdding={isAddingSupplier}
            setIsAdding={setIsAddingSupplier}
            editingSupplier={editingSupplier}
            setEditingSupplier={setEditingSupplier}
            setDeleteConfirmModal={setDeleteConfirmModal}
            onIntegrityBlock={handleShowIntegrityBlock}
         />
      )}

      {activeTab === 'invoices' && (
         <InvoicesTab 
            invoices={purchaseInvoices}
            suppliers={suppliers}
            supplierPayments={supplierPayments}
            inventoryProducts={inventoryProducts}
            orders={orders}
            settings={settings}
            addPurchaseInvoice={addPurchaseInvoice}
            updatePurchaseInvoice={updatePurchaseInvoice}
            deletePurchaseInvoice={deletePurchaseInvoice}
            recordStockAdjustment={recordStockAdjustment}
            isAdding={isAddingInvoice}
            setIsAdding={setIsAddingInvoice}
            setDeleteConfirmModal={setDeleteConfirmModal}
            onIntegrityBlock={handleShowIntegrityBlock}
         />
      )}

      {activeTab === 'payments' && (
         <SupplierPaymentsTab
            payments={supplierPayments}
            suppliers={suppliers}
            purchaseInvoices={purchaseInvoices}
            addSupplierPayment={addSupplierPayment}
            deleteSupplierPayment={deleteSupplierPayment}
            setDeleteConfirmModal={setDeleteConfirmModal}
            shippingInvoices={useStore.getState().shippingInvoices || []}
            settings={settings}
          />
      )}

      {/* مودال تأكيد الحذف الموحد */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">{deleteConfirmModal.title}</h3>
            <p className="text-sm font-medium text-slate-600 mb-6 leading-relaxed whitespace-pre-line">{deleteConfirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmModal({ ...deleteConfirmModal, isOpen: false })}
                className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  await deleteConfirmModal.onConfirm();
                  setDeleteConfirmModal({ ...deleteConfirmModal, isOpen: false });
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors shadow-sm text-sm"
              >
                نعم، تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال الحماية والتماسك الهيكلي */}
      <IntegrityProtectionModal
        isOpen={showIntegrityModal}
        onClose={() => setShowIntegrityModal(false)}
        result={integrityBlockResult}
      />
    </div>
  );
}

// دالة مساعدة لحساب إحصائيات المورد بدقة
function calcSupplierStats(s: Supplier, purchaseInvoices: PurchaseInvoice[], supplierPayments: SupplierPayment[], shippingInvoices: any[] = []) {
  if (!s) return { invoices: [], payments: [], totalInvoices: 0, totalPaid: 0, debt: 0 };
  
  const sId = String(s.id || '').trim();
  const sName = (s.name || '').trim().toLowerCase();

  const invoices = (purchaseInvoices || []).filter((i: any) => {
    const invSupId = String(i.supplierId || '').trim();
    const invSupName = String(i.supplierName || '').trim().toLowerCase();

    if (invSupId && sId && invSupId === sId) return true;
    if (invSupName && sName && invSupName === sName) return true;
    return false;
  });

  const payments = (supplierPayments || []).filter((p: any) => {
    const paySupId = String(p.supplierId || '').trim();
    const paySupName = String(p.supplierName || '').trim().toLowerCase();

    if (paySupId && sId && paySupId === sId) return true;
    if (paySupName && sName && paySupName === sName) return true;
    return false;
  });

  const totalInvoices = invoices.reduce((sum: number, i: any) => sum + Number(i.totalAmount || 0), 0);
  const shippingPayments = shippingInvoices.filter(si => si.linkedSupplierId === sId).reduce((sum, si) => sum + Number(si.linkedSupplierAmount || 0), 0);
  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) + shippingPayments;
  const debt = totalInvoices - totalPaid;

  return { invoices, payments, totalInvoices, totalPaid, debt };
}

function SupplierPaymentsTab({ payments, suppliers, purchaseInvoices, addSupplierPayment, deleteSupplierPayment, setDeleteConfirmModal, shippingInvoices = [], settings }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentData, setPaymentData] = useState({ supplierId: '', amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });
  const [viewingPaymentVoucher, setViewingPaymentVoucher] = useState<any | null>(null);
  const [showPaymentsReportModal, setShowPaymentsReportModal] = useState(false);

  // حساب الدين المتبقي للمورد المختار في نموذج الدفع
  const selectedSupplierObj = suppliers.find((s: any) => String(s.id) === String(paymentData.supplierId));
  const selectedSupplierDebt = selectedSupplierObj 
    ? calcSupplierStats(selectedSupplierObj, purchaseInvoices, payments, shippingInvoices || []).debt 
    : 0;

  const handleSupplierChange = (supId: string) => {
    const sup = suppliers.find((s: any) => String(s.id) === String(supId));
    let defaultAmount = 0;
    if (sup) {
      const { debt } = calcSupplierStats(sup, purchaseInvoices, payments, shippingInvoices || []);
      if (debt > 0) defaultAmount = debt;
    }
    setPaymentData({
      ...paymentData,
      supplierId: supId,
      amount: defaultAmount
    });
  };

  const handleSavePayment = async () => {
    if (!paymentData.supplierId) return toast.error('يرجى اختيار المورد');
    if (paymentData.amount <= 0) return toast.error('يرجى إدخال مبلغ صحيح أكبر من الصفر');
    
    const supplierObj = suppliers.find((s: any) => String(s.id) === String(paymentData.supplierId));
    
    try {
      await addSupplierPayment({
        id: crypto.randomUUID(),
        supplierId: paymentData.supplierId,
        supplierName: supplierObj?.name || '',
        amount: Number(paymentData.amount),
        date: paymentData.date,
        notes: paymentData.notes
      });
      toast.success('تم تسجيل الدفعة بنجاح وتحديث كشف حساب المورد');
      setIsAdding(false);
      setPaymentData({ supplierId: '', amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });
    } catch (e) {
      toast.error('حدث خطأ أثناء تسجيل الدفعة');
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      title: 'تأكيد حذف الدفعة',
      message: 'هل أنت تأكد من حذف هذه الدفعة؟ سيتم إعادة تسديدها وتحديث الرصيد المستحق للمورد.',
      onConfirm: async () => {
        try {
          await deleteSupplierPayment(paymentId);
          toast.success('تم حذف الدفعة بنجاح وتحديث الحسابات');
        } catch (e) {
          console.error(e);
          toast.error('حدث خطأ أثناء حذف الدفعة');
        }
      }
    });
  };

  // تصفية سجل المدفوعات حسب المورد أو التاريخ أو البحث
  const filteredPayments = payments.filter((p: any) => {
    const supplier = suppliers.find((s: any) => s.id === p.supplierId);
    const sName = (supplier?.name || p.supplierName || '').toLowerCase();
    const notes = (p.notes || '').toLowerCase();
    const query = searchTerm.toLowerCase().trim();

    const matchesSupplierFilter = !selectedSupplierId || p.supplierId === selectedSupplierId || (supplier && supplier.id === selectedSupplierId);
    const matchesQuery = !query || sName.includes(query) || notes.includes(query) || p.date?.includes(query);
    const matchesStartDate = !startDate || (p.date && p.date >= startDate);
    const matchesEndDate = !endDate || (p.date && p.date <= endDate);

    return matchesSupplierFilter && matchesQuery && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
         <div className="flex flex-1 flex-col sm:flex-row gap-3">
           <div className="relative flex-1">
             <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
             <input
               type="text"
               placeholder="البحث في سجل المدفوعات أو الملاحظات..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full pl-4 pr-9 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"
             />
           </div>
           <select
             value={selectedSupplierId}
             onChange={e => setSelectedSupplierId(e.target.value)}
             className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 bg-white min-w-[200px]"
           >
             <option value="">كل الموردين ({suppliers.length})</option>
             {suppliers.map((s: any) => (
               <option key={s.id} value={s.id}>{s.name}</option>
             ))}
           </select>
           <div className="flex gap-2 min-w-[250px]">
             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500" title="من تاريخ" />
             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500" title="إلى تاريخ" />
           </div>
         </div>

         <div className="flex gap-2">
           <button 
             onClick={() => setShowPaymentsReportModal(true)} 
             className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm print:hidden cursor-pointer"
             title="معاينة وطباعة كشف وسجل مدفوعات الموردين"
           >
             <Printer className="w-4 h-4 text-emerald-400" />
             طباعة كشف المدفوعات
           </button>
           <button onClick={() => setIsAdding(!isAdding)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm print:hidden">
             <Plus className="w-5 h-5" />
             تسجيل دفعة جديدة
           </button>
         </div>
       </div>

       {isAdding && (
         <div className="bg-white p-6 rounded-2xl border-2 border-emerald-500/30 shadow-lg mb-6 animate-in fade-in zoom-in duration-150">
           <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
               <DollarSign className="w-5 h-5 text-emerald-600" />
               تسجيل دفعة جديدة لمورد
             </h3>
             <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">المورد المستلم *</label>
               <select 
                 value={paymentData.supplierId || ''} 
                 onChange={e => handleSupplierChange(e.target.value)} 
                 className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors bg-white"
               >
                  <option value="">-- اختر المورد --</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
               {paymentData.supplierId && (
                 <p className={`text-xs font-bold mt-1.5 ${selectedSupplierDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                   {selectedSupplierDebt > 0 ? `الديون المستحقة حالياً: ${selectedSupplierDebt.toLocaleString()} د.ج` : 'لا توجد ديون مستحقة على هذا المورد'}
                 </p>
               )}
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">المبلغ المدفوع (د.ج) *</label>
               <input 
                 type="number" 
                 min="0" 
                 value={paymentData.amount || ''} 
                 onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})} 
                 placeholder="أدخل المبلغ..."
                 className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-black text-emerald-600 outline-none focus:border-emerald-500 transition-colors text-lg" 
                 dir="ltr" 
               />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الدفع *</label>
               <input 
                 type="date" 
                 value={paymentData.date} 
                 onChange={e => setPaymentData({...paymentData, date: e.target.value})} 
                 className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors" 
               />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات / طريقة الدفع</label>
               <input 
                 type="text" 
                 placeholder="مثلاً: نقداً، تحويل بنكيCCP، وصل تسليم..."
                 value={paymentData.notes ?? ''} 
                 onChange={e => setPaymentData({...paymentData, notes: e.target.value})} 
                 className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors" 
               />
             </div>
           </div>
           <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-slate-100">
             <button onClick={() => setIsAdding(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">إلغاء</button>
             <button onClick={handleSavePayment} className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2">
               <CheckCircle2 className="w-4 h-4" /> تأكيد وتعميم الدفع
             </button>
           </div>
         </div>
       )}

       <div className="space-y-3">
         {filteredPayments.map((p: any) => {
            const supplier = suppliers.find((s: any) => s.id === p.supplierId);
            const supplierName = supplier?.name || p.supplierName || 'غير محدد';
            
            return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <ArrowDownLeft className="w-6 h-6" />
                  </div>
                  <div>
                     <h4 className="font-black text-slate-800 text-lg flex items-center gap-2">
                       {supplierName}
                       <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">دفعة مقبوضة</span>
                     </h4>
                     <div className="flex flex-wrap items-center gap-3 mt-1 text-xs font-bold text-slate-500">
                        <span>تاريخ الدفع: {p.date}</span>
                        {p.notes && <span className="text-slate-400">• {p.notes}</span>}
                     </div>
                  </div>
               </div>
               <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 flex-wrap">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">المبلغ المدفوع</div>
                    <div className="text-xl font-black text-emerald-600" dir="ltr">+{Number(p.amount).toLocaleString()} <span className="text-xs font-bold">د.ج</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setViewingPaymentVoucher(p)} 
                      className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-colors border border-emerald-200 print:hidden flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs" 
                      title="معاينة وطباعة سند صرف / وصل دفع للمورد"
                    >
                      <Printer className="w-4 h-4 text-emerald-600" />
                      <span className="hidden sm:inline">طباعة وصل الدفعة</span>
                    </button>
                    <button 
                      onClick={() => handleDeletePayment(p.id)} 
                      className="text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 p-2.5 rounded-xl transition-colors border border-slate-200 hover:border-rose-200 print:hidden cursor-pointer" 
                      title="حذف الدفعة"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
               </div>
            </div>
         )})}

         {filteredPayments.length === 0 && (
           <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
              <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-bold">لا توجد مدفوعات مسجلة تطابق خيارات البحث</p>
           </div>
         )}
       </div>

        {/* Modal معاينة وطباعة كشف وسجل المدفوعات */}
        {showPaymentsReportModal && (
          <SupplierPaymentsReportModal
            isOpen={showPaymentsReportModal}
            onClose={() => setShowPaymentsReportModal(false)}
            payments={filteredPayments}
            suppliers={suppliers}
            selectedSupplierId={selectedSupplierId}
            startDate={startDate}
            endDate={endDate}
            storeName={settings?.storeName || 'إدارة المخزون والمشتريات'}
          />
        )}

        {/* Modal معاينة وطباعة سند الصرف / وصل الدفعة */}
        {viewingPaymentVoucher && (
          <SupplierPaymentVoucherModal
            isOpen={!!viewingPaymentVoucher}
            onClose={() => setViewingPaymentVoucher(null)}
            payment={viewingPaymentVoucher}
            supplier={suppliers.find((s: any) => s.id === viewingPaymentVoucher.supplierId)}
            storeName={settings?.storeName || 'إدارة المخزون والمشتريات'}
          />
        )}
    </div>
  );
}

function SuppliersTab({ suppliers, purchaseInvoices, supplierPayments, addSupplier, updateSupplier, deleteSupplier, addSupplierPayment, isAdding, setIsAdding, editingSupplier, setEditingSupplier, setDeleteConfirmModal, onIntegrityBlock }: any) {
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', notes: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [paymentData, setPaymentData] = useState({ amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });

  // حالة كشف حساب المورد التفصيلي Modal
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  const handleOpenAdd = () => {
    setFormData({ name: '', phone: '', address: '', notes: '' });
    setEditingSupplier(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setFormData({ name: s.name, phone: s.phone || '', address: s.address || '', notes: s.notes || '' });
    setEditingSupplier(s);
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return toast.error('يرجى إدخال اسم المورد');
    
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData);
        toast.success('تم تحديث بيانات المورد بنجاح');
      } else {
        await addSupplier({ ...formData, id: crypto.randomUUID() });
        toast.success('تم إضافة المورد بنجاح');
      }
      setIsAdding(false);
    } catch (e) {
      toast.error('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const handleDeleteSupplierClick = (supplierId: string, supplierName: string) => {
    const supplier = suppliers.find((s: any) => s.id === supplierId);
    if (supplier) {
      const check = checkSupplierDeletionIntegrity(supplier, {
        purchaseInvoices,
        supplierPayments
      });
      if (!check.canDelete) {
        onIntegrityBlock?.(check);
        return;
      }
    }

    setDeleteConfirmModal({
      isOpen: true,
      title: 'تأكيد حذف المورد',
      message: `هل أنت متأكد من حذف المورد "${supplierName}"؟`,
      onConfirm: async () => {
        try {
          await deleteSupplier(supplierId);
          toast.success('تم حذف المورد بنجاح');
        } catch (e: any) {
          if (e?.name === 'DataIntegrityError') {
            onIntegrityBlock?.({
              canDelete: false,
              title: e.title || 'محظور لحماية تماسك النظام',
              reason: e.message,
              details: e.details || [],
              suggestions: e.suggestions || []
            });
          } else {
            toast.error('حدث خطأ أثناء الحذف');
          }
        }
      }
    });
  };

  const handleOpenPaymentModal = (s: Supplier) => {
    const { debt } = calcSupplierStats(s, purchaseInvoices, supplierPayments, useStore.getState().shippingInvoices || []);
    setSelectedSupplierForPayment(s);
    setPaymentData({
      amount: debt > 0 ? debt : 0,
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async () => {
    if (!selectedSupplierForPayment) return;
    if (paymentData.amount <= 0) return toast.error('يرجى إدخال مبلغ صحيح أكبر من الصفر');
    try {
      await addSupplierPayment({
        id: crypto.randomUUID(),
        supplierId: selectedSupplierForPayment.id,
        supplierName: selectedSupplierForPayment.name,
        amount: Number(paymentData.amount),
        date: paymentData.date,
        notes: paymentData.notes
      });
      toast.success(`تم تسجيل دفعة بقيمة ${paymentData.amount.toLocaleString()} د.ج للمورد ${selectedSupplierForPayment.name}`);
      setPaymentModalOpen(false);
    } catch (e) {
      toast.error('حدث خطأ أثناء تسجيل الدفعة');
    }
  };

  const filteredSuppliers = suppliers.filter((s: Supplier) => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    return (s.name || '').toLowerCase().includes(query) || 
           (s.phone || '').toLowerCase().includes(query) || 
           (s.address || '').toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="البحث باسم المورد، الهاتف أو العنوان..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-9 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
          />
        </div>
        <button onClick={handleOpenAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
          <Plus className="w-5 h-5" />
          إضافة مورد جديد
        </button>
      </div>

      {isAdding && (
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-150">
           <h3 className="text-lg font-black text-slate-800 mb-4 pb-2 border-b border-slate-100">{editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المورد / الشركة *</label>
               <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" placeholder="مثلاً: شركة الجزيرة للاستيراد" />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الهاتف</label>
               <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" placeholder="0550XXXXXX" dir="ltr" />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">العنوان / الموقع</label>
               <input type="text" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" placeholder="مثلاً: العاصمة، المنطقة الصناعية" />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات إضافية</label>
               <input type="text" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" placeholder="ملاحظات الحساب أو الشروط..." />
             </div>
           </div>
           <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
             <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold transition-colors">إلغاء</button>
             <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm">حفظ البيانات</button>
           </div>
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map((s: Supplier) => {
          const { invoices, payments, totalInvoices, totalPaid, debt } = calcSupplierStats(s, purchaseInvoices, supplierPayments, useStore.getState().shippingInvoices || []);

          return (
          <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
             {debt > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-rose-500"></div>}
             {debt <= 0 && totalInvoices > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>}
             
             <div>
               <div className="flex justify-between items-start gap-2 mb-2">
                 <div>
                   <h4 className="text-lg font-black text-slate-800">{s.name}</h4>
                   {s.phone && <div className="text-xs font-bold text-slate-500 mt-0.5" dir="ltr">{s.phone}</div>}
                 </div>
                 <div className="flex items-center gap-1">
                   <button 
                     onClick={() => handleOpenPaymentModal(s)} 
                     className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                     title="تسجيل دفعة للمورد"
                   >
                     <DollarSign className="w-3.5 h-3.5" /> دفع
                   </button>
                   <button 
                     onClick={() => setStatementSupplier(s)} 
                     className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-xl transition-colors" 
                     title="كشف حساب المورد"
                   >
                     <History className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={() => handleOpenEdit(s)} 
                     className="text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-xl transition-colors" 
                     title="تعديل"
                   >
                     <Edit2 className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={() => handleDeleteSupplierClick(s.id, s.name)} 
                     className="text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 p-1.5 rounded-xl transition-colors" 
                     title="حذف المورد"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               </div>

               {s.address && <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg mb-3">{s.address}</div>}
               
               <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-slate-50 rounded-xl p-2.5 flex flex-col border border-slate-100">
                     <span className="text-[10px] text-slate-400 font-bold mb-0.5">إجمالي المشتريات ({invoices.length})</span>
                     <span className="text-sm font-black text-slate-800">{totalInvoices.toLocaleString()} <span className="text-[10px]">د.ج</span></span>
                  </div>
                  <div className="bg-emerald-50/60 rounded-xl p-2.5 flex flex-col border border-emerald-100">
                     <span className="text-[10px] text-emerald-700 font-bold mb-0.5">المسدد ({payments.length})</span>
                     <span className="text-sm font-black text-emerald-700">{totalPaid.toLocaleString()} <span className="text-[10px]">د.ج</span></span>
                  </div>
                  <div className={`col-span-2 rounded-xl p-2.5 flex justify-between items-center border ${debt > 0 ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                     <span className="text-xs text-slate-500 font-bold">الرصيد المستحق (الدين):</span>
                     <span className={`text-base font-black ${debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{debt.toLocaleString()} <span className="text-[10px]">د.ج</span></span>
                  </div>
               </div>
             </div>

             {s.notes && <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-100">{s.notes}</div>}
          </div>
        )})}

        {filteredSuppliers.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
             <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
             <p className="text-slate-500 font-bold">لم يتم العثور على أي موردين</p>
          </div>
        )}
      </div>

      {/* Modal تسجيل دفعة لمورد */}
      {paymentModalOpen && selectedSupplierForPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150" dir="rtl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                تسجيل دفعة: {selectedSupplierForPayment.name}
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">المبلغ المدفوع (د.ج) *</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={paymentData.amount || ''} 
                    onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})} 
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-black text-emerald-600 text-lg outline-none focus:border-emerald-500 transition-colors" 
                    dir="ltr" 
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الدفع *</label>
                   <input 
                    type="date" 
                    value={paymentData.date || ''} 
                    onChange={e => setPaymentData({...paymentData, date: e.target.value})} 
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors" 
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات والتفاصيل</label>
                  <input 
                    type="text" 
                    placeholder="مثلاً: تحويل بنكي، كاش..."
                    value={paymentData.notes || ''} 
                    onChange={e => setPaymentData({...paymentData, notes: e.target.value})} 
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors" 
                  />
               </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
               <button onClick={() => setPaymentModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">إلغاء</button>
               <button onClick={handleSavePayment} className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm">تأكيد الدفع</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal كشف حساب المورد التفصيلي */}
      {statementSupplier && (
        <SupplierStatementModal 
          supplier={statementSupplier}
          purchaseInvoices={purchaseInvoices}
          supplierPayments={supplierPayments}
          onClose={() => setStatementSupplier(null)}
          onAddPayment={() => {
            const sup = statementSupplier;
            setStatementSupplier(null);
            handleOpenPaymentModal(sup);
          }}
        />
      )}
    </div>
  );
}

// مكون كشف حساب المورد التفصيلي
function SupplierStatementModal({ supplier, purchaseInvoices, supplierPayments, onClose, onAddPayment }: any) {
  const { invoices, payments, totalInvoices, totalPaid, debt } = calcSupplierStats(supplier, purchaseInvoices, supplierPayments, useStore.getState().shippingInvoices || []);

  // دمج العمليات مرتبة حسب التاريخ
  const timeline = [
    ...invoices.map((inv: any) => ({
      id: inv.id,
      type: 'invoice',
      date: inv.date || inv.createdAt?.slice(0,10) || '',
      title: `فاتورة شراء #${inv.invoiceNumber || String(inv.id || '').slice(0,8)}`,
      amount: Number(inv.totalAmount || 0),
      itemsCount: inv.items?.length || 0,
      notes: inv.notes
    })),
    ...payments.map((p: any) => ({
      id: p.id,
      type: 'payment',
      date: p.date,
      title: `دفعة سداد للمورد`,
      amount: Number(p.amount || 0),
      notes: p.notes
    }))
  ].sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0;
    const timeB = new Date(b.date).getTime() || 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.type === 'invoice' ? -1 : 1;
  });

  let runningBalance = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
      <div id="printable-supplier-statement" className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
               <History className="w-5 h-5" />
             </div>
             <div>
                <h3 className="font-black text-slate-800 text-lg">كشف حساب المورد: {supplier.name}</h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">{supplier.phone ? `هاتف: ${supplier.phone}` : 'سجل حركة الحساب والديون'}</p>
             </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shadow-sm border border-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
           {/* بطاقات الملخص */}
           <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                 <div className="text-xs font-bold text-slate-400 mb-1">إجمالي المشتريات</div>
                 <div className="font-black text-slate-800 text-base">{totalInvoices.toLocaleString()} <span className="text-[10px]">د.ج</span></div>
              </div>
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100">
                 <div className="text-xs font-bold text-emerald-600 mb-1">المبلغ المسدد</div>
                 <div className="font-black text-emerald-700 text-base">{totalPaid.toLocaleString()} <span className="text-[10px]">د.ج</span></div>
              </div>
              <div className={`p-3.5 rounded-xl border ${debt > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                 <div className="text-xs font-bold mb-1">الرصيد المستحق (الدين)</div>
                 <div className="font-black text-lg">{debt.toLocaleString()} <span className="text-xs">د.ج</span></div>
              </div>
           </div>

           <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center justify-between">
             <span>جدول الحركات والعمليات الترتيب الزمني:</span>
             <button onClick={onAddPayment} className="text-emerald-700 hover:text-emerald-800 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 transition-colors">
               + تسجيل دفعة الآن
             </button>
           </h4>

           {timeline.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                 <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                       <tr>
                          <th className="px-3 py-2.5">التاريخ</th>
                          <th className="px-3 py-2.5">البيان / الحركة</th>
                          <th className="px-3 py-2.5 text-center">فاتورة (+)</th>
                          <th className="px-3 py-2.5 text-center">دفعة (-)</th>
                          <th className="px-3 py-2.5 text-left">الرصيد التراكمي</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                       {timeline.map((item) => {
                          if (item.type === 'invoice') runningBalance += item.amount;
                          else runningBalance -= item.amount;

                          return (
                             <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-2.5 text-slate-500">{item.date}</td>
                                <td className="px-3 py-2.5">
                                   <span className="text-slate-800">{item.title}</span>
                                   {item.notes && <p className="text-[10px] text-slate-400 font-normal">{item.notes}</p>}
                                </td>
                                <td className="px-3 py-2.5 text-center text-rose-600">
                                   {item.type === 'invoice' ? `+${item.amount.toLocaleString()} د.ج` : '-'}
                                </td>
                                <td className="px-3 py-2.5 text-center text-emerald-600">
                                   {item.type === 'payment' ? `-${item.amount.toLocaleString()} د.ج` : '-'}
                                </td>
                                <td className={`px-3 py-2.5 text-left font-black ${runningBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                   {runningBalance.toLocaleString()} د.ج
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           ) : (
              <div className="py-8 text-center text-slate-400 font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                 لا توجد عمليات سابقة لهذا المورد
              </div>
           )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between print:hidden">
           <button 
             onClick={() => triggerPrint({ printableElementId: 'printable-supplier-statement', title: `كشف_حساب_المورد_${supplier.name}` })}
             className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors text-xs flex items-center gap-2 cursor-pointer shadow-sm"
           >
             <Printer className="w-4 h-4 text-emerald-400" />
             <span>طباعة كشف الحساب</span>
           </button>
           <button onClick={onClose} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors text-xs cursor-pointer">إغلاق</button>
        </div>
      </div>
    </div>
  );
}

function InvoicesTab({ invoices, suppliers, supplierPayments, inventoryProducts, orders, settings, addPurchaseInvoice, updatePurchaseInvoice, deletePurchaseInvoice, recordStockAdjustment, isAdding, setIsAdding, setDeleteConfirmModal, onIntegrityBlock }: any) {
  const [formData, setFormData] = useState<{ supplierId: string, invoiceNumber: string, date: string, notes: string, paymentStatus: 'paid' | 'unpaid' | 'partial', paymentNotes: string }>({ supplierId: '', invoiceNumber: '', date: new Date().toISOString().split('T')[0], notes: '', paymentStatus: 'unpaid', paymentNotes: '' });
  const [items, setItems] = useState<PurchaseInvoiceItem[]>([]);
  const [viewInvoice, setViewInvoice] = useState<PurchaseInvoice | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [addingSubInvoiceFor, setAddingSubInvoiceFor] = useState<any>(null);
  const [subInvoiceData, setSubInvoiceData] = useState<{ date: string, notes: string, additionalExpenses: number, paymentStatus: 'paid' | 'unpaid' | 'partial', paymentNotes: string }>({ date: new Date().toISOString().split('T')[0], notes: '', additionalExpenses: 0, paymentStatus: 'unpaid', paymentNotes: '' });
  const [subInvoiceItems, setSubInvoiceItems] = useState<PurchaseInvoiceItem[]>([]);
  const [viewSubInvoice, setViewSubInvoice] = useState<{mainInvId: string, mainInvNo: string, supplierName: string, subInv: any} | null>(null);

  const handleOpenAddSubInvoice = (inv: any) => {
    setAddingSubInvoiceFor(inv);
    setSubInvoiceData({ date: new Date().toISOString().split('T')[0], notes: '', additionalExpenses: 0, paymentStatus: 'unpaid', paymentNotes: '' });
    // Copy items from main invoice
    setSubInvoiceItems(inv.items.map((i: any) => ({...i, id: crypto.randomUUID()})));
  };

  const updateSubItem = (id: string, field: keyof PurchaseInvoiceItem, value: any) => {
    setSubInvoiceItems(subInvoiceItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitCost') {
          updated.totalCost = Number(updated.quantity) * Number(updated.unitCost);
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSaveSubInvoice = async () => {
    if (!addingSubInvoiceFor) return;
    const preparedItems = subInvoiceItems.filter(i => i.quantity > 0 && i.unitCost > 0);
    if (preparedItems.length === 0) return toast.error('أضف صنف واحد على الأقل بكمية وتكلفة صحيحة');
    
    const itemsTotal = preparedItems.reduce((sum, item) => sum + item.totalCost, 0);
    const totalAmount = itemsTotal + Number(subInvoiceData.additionalExpenses);
    
    const newSubInv = {
      id: crypto.randomUUID(),
      subInvoiceNumber: `SUB-${Date.now().toString().slice(-6)}`,
      date: subInvoiceData.date,
      items: preparedItems,
      additionalExpenses: Number(subInvoiceData.additionalExpenses),
      totalAmount,
      paymentStatus: subInvoiceData.paymentStatus,
      paymentNotes: subInvoiceData.paymentNotes,
      notes: subInvoiceData.notes,
      createdAt: new Date().toISOString()
    };
    
    const updatedMainInv = {
      ...addingSubInvoiceFor,
      subInvoices: [...(addingSubInvoiceFor.subInvoices || []), newSubInv]
    };
    
    try {
      if (updatePurchaseInvoice) {
        await updatePurchaseInvoice(addingSubInvoiceFor.id, updatedMainInv);
        toast.success('تم إنشاء الفاتورة الفرعية بنجاح');
        setAddingSubInvoiceFor(null);
      }
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء حفظ الفاتورة الفرعية');
    }
  };

  const handleDeleteSubInvoice = async (mainInv: any, subInvId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة الفرعية؟')) return;
    const updatedMainInv = {
      ...mainInv,
      subInvoices: (mainInv.subInvoices || []).filter((s: any) => s.id !== subInvId)
    };
    try {
      if (updatePurchaseInvoice) {
        await updatePurchaseInvoice(mainInv.id, updatedMainInv);
        toast.success('تم حذف الفاتورة الفرعية بنجاح');
      }
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handleOpenAdd = () => {
    setEditingInvoiceId(null);
    setFormData({ supplierId: '', invoiceNumber: '', date: new Date().toISOString().split('T')[0], notes: '', paymentStatus: 'unpaid', paymentNotes: '' });
    setItems([]);
    setIsAdding(true);
  };

  const handleEditInvoice = (inv: any) => {
    setEditingInvoiceId(inv.id);
    setFormData({
      supplierId: inv.supplierId || '',
      invoiceNumber: inv.invoiceNumber || '',
      date: inv.date || '',
      notes: inv.notes || '',
      paymentStatus: inv.paymentStatus || 'unpaid',
      paymentNotes: inv.paymentNotes || ''
    });
    setItems(inv.items || []);
    setIsAdding(true);
  };

  const handleAddItem = () => {
    setItems([...items, { id: crypto.randomUUID(), sku: '', productName: '', quantity: 1, unitCost: 0, totalCost: 0 }]);
  };

  const updateItem = (id: string, field: keyof PurchaseInvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitCost') {
          updated.totalCost = Number(updated.quantity) * Number(updated.unitCost);
        }
        if (field === 'sku') {
           const valLower = String(value || '').trim().toLowerCase();
           if (valLower) {
             let matched = false;
             for (const product of inventoryProducts) {
               if (product.variations && product.variations.length > 0) {
                 const variation = product.variations.find((v: any) => v.sku && v.sku.trim().toLowerCase() === valLower);
                 if (variation) {
                   const varOpt = variation.name || variation.attributes?.map((a: any) => a.option).join(' ') || '';
                   updated.productName = `${product.name} - ${varOpt}`;
                   updated.unitCost = Number(variation.local_cost) || 0;
                   updated.totalCost = Number(updated.quantity) * Number(updated.unitCost);
                   matched = true;
                   break;
                 }
               }
             }

             if (!matched) {
               for (const product of inventoryProducts) {
                 const hasVars = product.variations && product.variations.length > 0;
                 if (product.sku && product.sku.trim().toLowerCase() === valLower) {
                   updated.productName = product.name;
                   if (!hasVars) {
                     updated.unitCost = Number(product.local_cost) || 0;
                     updated.totalCost = Number(updated.quantity) * Number(updated.unitCost);
                   } else {
                     updated.unitCost = 0;
                     updated.totalCost = 0;
                   }
                   break;
                 }
               }
             }
           }
        }
        if (field === 'productName') {
           const valLower = String(value || '').trim().toLowerCase();
           if (valLower) {
             let matched = false;
             for (const product of inventoryProducts) {
               const pName = (product.name || '').trim().toLowerCase();
               if (product.variations && product.variations.length > 0) {
                 const variation = product.variations.find((v: any) => {
                   const vOpt = (v.name || v.attributes?.map((a: any) => a.option).join(' ') || '').trim().toLowerCase();
                   const combined = `${pName} - ${vOpt}`.trim().toLowerCase();
                   return combined === valLower || (valLower.includes(pName) && valLower.includes(vOpt));
                 });
                 if (variation) {
                   const varOpt = variation.name || variation.attributes?.map((a: any) => a.option).join(' ') || '';
                   updated.sku = variation.sku || '';
                   updated.unitCost = Number(variation.local_cost) || 0;
                   updated.totalCost = Number(updated.quantity) * Number(updated.unitCost);
                   matched = true;
                   break;
                 }
               }
             }

             if (!matched) {
               for (const product of inventoryProducts) {
                 const pName = (product.name || '').trim().toLowerCase();
                 const hasVars = product.variations && product.variations.length > 0;
                 if (pName === valLower) {
                   updated.sku = product.sku || '';
                   if (!hasVars) {
                     updated.unitCost = Number(product.local_cost) || 0;
                     updated.totalCost = Number(updated.quantity) * Number(updated.unitCost);
                   } else {
                     updated.unitCost = 0;
                     updated.totalCost = 0;
                   }
                   break;
                 }
               }
             }
           }
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSave = async () => {
    if (!formData.supplierId) return toast.error('يرجى اختيار المورد');
    if (items.length === 0) return toast.error('أضف منتج واحد على الأقل بالفاتورة');

    // Auto fill SKU if missing from product name
    const preparedItems = items.map(i => ({
       ...i,
       sku: i.sku || (i.productName ? `SKU-${i.productName.replace(/\s+/g, '-').slice(0, 15)}` : '')
    }));

    if (preparedItems.some(i => !i.sku || i.quantity <= 0 || i.unitCost <= 0)) {
       return toast.error('تأكد من إدخال رمز المنتج والكمية وتكلفة الوحدة (أكبر من 0) لكل العناصر');
    }

    const totalAmount = preparedItems.reduce((sum, item) => sum + item.totalCost, 0);
    const supplierObj = suppliers.find((s: any) => s.id === formData.supplierId);
    const supplierName = supplierObj?.name || '';

    try {
      if (editingInvoiceId) {
         if (updatePurchaseInvoice) {
           await updatePurchaseInvoice(editingInvoiceId, {
              ...formData,
              supplierName,
              items: preparedItems,
              totalAmount,
           });
           toast.success('تم تعديل الفاتورة بنجاح');
         }
      } else {
         await addPurchaseInvoice({
           id: crypto.randomUUID(),
           ...formData,
           supplierName,
           items: preparedItems,
           totalAmount,
           createdAt: new Date().toISOString()
         });

         toast.success('تم حفظ الفاتورة وتحديث كشف حساب المورد بنجاح');
      }
      setIsAdding(false);
      setEditingInvoiceId(null);
    } catch (e) {
      toast.error('حدث خطأ أثناء حفظ الفاتورة');
    }
  };

  const handleDeleteInvoiceClick = (id: string) => {
    const invToDelete = invoices.find((x: any) => x.id === id);
    if (invToDelete) {
      const check = checkPurchaseInvoiceDeletionIntegrity(invToDelete, {
        inventoryProducts,
        orders,
        purchaseInvoices: invoices,
        settings
      });
      if (!check.canDelete) {
        onIntegrityBlock?.(check);
        return;
      }
    }

    setDeleteConfirmModal({
      isOpen: true,
      title: 'تأكيد حذف فاتورة الشراء',
      message: 'سيتم حذف الفاتورة وتحديث كشف حساب المورد، هل أنت متأكد؟',
      onConfirm: async () => {
        try {
          await deletePurchaseInvoice(id);
          toast.success('تم حذف الفاتورة وتحديث حساب المورد بنجاح');
        } catch (e: any) {
          if (e?.name === 'DataIntegrityError') {
            onIntegrityBlock?.({
              canDelete: false,
              title: e.title || 'محظور لحماية تماسك النظام',
              reason: e.message,
              details: e.details || [],
              suggestions: e.suggestions || []
            });
          } else {
            console.error(e);
            toast.error('حدث خطأ أثناء حذف الفاتورة');
          }
        }
      }
    });
  };

  const filteredInvoices = invoices.filter((inv: PurchaseInvoice) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSupplier = !selectedSupplierId || inv.supplierId === selectedSupplierId;
    
    if (!matchesSupplier) return false;
    if (!query) return true;

    return (inv.supplierName || '').toLowerCase().includes(query) ||
           (inv.invoiceNumber || '').toLowerCase().includes(query) ||
           (inv.date || '').includes(query) ||
           (inv.items && inv.items.some(i => (i.productName || '').toLowerCase().includes(query) || (i.sku || '').toLowerCase().includes(query)));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث باسم المورد، رقم الفاتورة، اسم المنتج أو SKU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-9 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={selectedSupplierId}
            onChange={e => setSelectedSupplierId(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 bg-white min-w-[200px]"
          >
            <option value="">كل الموردين ({suppliers.length})</option>
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2 min-w-[250px]">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500" title="من تاريخ" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500" title="إلى تاريخ" />
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => triggerPrint({ printableElementId: 'printable-invoices-list', title: `سجل_فواتير_الشراء_${new Date().toISOString().split('T')[0]}` })} 
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm print:hidden cursor-pointer"
            title="طباعة سجل فواتير الشراء"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            طباعة
          </button>
          <button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm print:hidden">
            <Plus className="w-5 h-5" />
            فاتورة شراء جديدة
          </button>
        </div>
      </div>

      {isAdding && (
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-150">
           <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
              <FileText className="w-5 h-5 text-indigo-600" />
              {editingInvoiceId ? 'تعديل فاتورة الشراء' : 'تسجيل فاتورة جديدة وتحديث المخزون'}
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative z-10">
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">المورد *</label>
               <select 
                 value={formData.supplierId || ''} 
                 onChange={e => setFormData({...formData, supplierId: e.target.value})} 
                 className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors bg-white"
               >
                 <option value="">-- اختر المورد --</option>
                 {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الفاتورة (اختياري)</label>
               <input type="text" value={formData.invoiceNumber ?? ''} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" placeholder="مثلاً: INV-2026-001" />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">التاريخ *</label>
               <input type="date" value={formData.date ?? ''} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" />
             </div>
           </div>

           <div className="mb-6">
             <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-slate-700">المنتجات المشتراة (تضاف تلقائياً للكميات وتحديث تكلفة الوحدة)</h4>
                <button onClick={handleAddItem} className="text-indigo-600 hover:text-indigo-800 text-xs font-bold bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                  <PackagePlus className="w-4 h-4" /> إضافة صنف
                </button>
             </div>
             
             {items.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                   <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 border-b border-slate-200">
                         <tr>
                            <th className="px-4 py-3 font-bold text-slate-600">رمز SKU</th>
                            <th className="px-4 py-3 font-bold text-slate-600">اسم المنتج</th>
                            <th className="px-4 py-3 font-bold text-slate-600 w-28 text-center">الكمية المستلمة</th>
                            <th className="px-4 py-3 font-bold text-slate-600 w-36 text-center">تكلفة الوحدة (د.ج)</th>
                            <th className="px-4 py-3 font-bold text-slate-600 w-36 text-center">الإجمالي</th>
                            <th className="px-4 py-3 font-bold text-slate-600 w-10"></th>
                         </tr>
                      </thead>
                      <tbody>
                         {items.map((item) => (
                           <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                             <td className="p-2 relative">
                               <input list={`skus-${item.id}`} type="text" value={item.sku || ''} onChange={e => {
                                 const val = e.target.value;
                                 updateItem(item.id, 'sku', val);
                               }} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-700" placeholder="SKU" />
                               <datalist id={`skus-${item.id}`}>
                                  {inventoryProducts.flatMap((p: any) => {
                                     const hasVars = p.variations && p.variations.length > 0;
                                     const options = [];
                                     if (!hasVars && p.sku) options.push(<option key={`${p.id}-main`} value={p.sku}>{p.name}</option>);
                                     if (hasVars) {
                                         p.variations.forEach((v: any) => {
                                             const vOpt = v.name || v.attributes?.map((a: any) => a.option).join(' ') || '';
                                             if (v.sku) options.push(<option key={v.sku} value={v.sku}>{p.name} - {vOpt}</option>);
                                         });
                                     }
                                     return options;
                                  })}
                               </datalist>
                             </td>
                             <td className="p-2 relative">
                               <input list={`names-${item.id}`} type="text" value={item.productName || ''} onChange={e => {
                                 const val = e.target.value;
                                 updateItem(item.id, 'productName', val);
                               }} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-700" placeholder="الاسم" />
                               <datalist id={`names-${item.id}`}>
                                  {inventoryProducts.flatMap((p: any) => {
                                     const hasVars = p.variations && p.variations.length > 0;
                                     const options = [];
                                     if (!hasVars) options.push(<option key={`${p.id}-main-name`} value={p.name} />);
                                     if (hasVars) {
                                         p.variations.forEach((v: any) => {
                                             const vOpt = v.name || v.attributes?.map((a: any) => a.option).join(' ') || '';
                                             options.push(<option key={`${v.sku || v.id}-name`} value={`${p.name} - ${vOpt}`} />);
                                         });
                                     }
                                     return options;
                                  })}
                               </datalist>
                             </td>
                             <td className="p-2 w-28">
                               <input type="number" min="1" value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-700 text-center" />
                             </td>
                             <td className="p-2 w-36">
                               <input type="number" min="0" value={item.unitCost || ''} onChange={e => updateItem(item.id, 'unitCost', Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-emerald-600 text-center" />
                             </td>
                             <td className="p-2 w-36 font-black text-rose-600 text-center">
                               {item.totalCost.toLocaleString()}
                             </td>
                             <td className="p-2 w-10 text-center">
                               <button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-slate-400 hover:text-rose-500 rounded p-1"><Trash2 className="w-4 h-4" /></button>
                             </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             ) : (
                <div className="py-8 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center text-slate-500 font-bold mb-4 flex flex-col items-center justify-center gap-2">
                   <PackagePlus className="w-8 h-8 text-slate-300" />
                   صندوق الأصناف فارغ
                </div>
             )}
             
             {items.length > 0 && (
                <div className="flex justify-between items-center mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                   <span className="font-bold text-slate-600">إجمالي الفاتورة :</span>
                   <span className="text-xl font-black text-indigo-700">{items.reduce((s,i) => s + i.totalCost, 0).toLocaleString()} د.ج</span>
                </div>
             )}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات الفاتورة</label>
               <input type="text" value={formData.notes ?? ''} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" placeholder="أية ملاحظات إضافية..." />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">حالة الدفع</label>
               <select value={formData.paymentStatus ?? 'unpaid'} onChange={e => setFormData({...formData, paymentStatus: e.target.value as any})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors bg-white">
                 <option value="unpaid">غير مدفوعة (دين)</option>
                 <option value="paid">مدفوعة بالكامل</option>
                 <option value="partial">مدفوعة جزئياً</option>
               </select>
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات الدفع</label>
               <input type="text" value={formData.paymentStatus !== 'unpaid' ? (formData.paymentNotes ?? '') : ''} disabled={formData.paymentStatus === 'unpaid'} onChange={e => setFormData({...formData, paymentNotes: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:bg-slate-50" placeholder="مبلغ الدفعة، أو رقم الشيك..." />
             </div>
           </div>

           <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-slate-100">
             <button onClick={() => { setIsAdding(false); setEditingInvoiceId(null); }} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold transition-colors">إلغاء</button>
             <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">{editingInvoiceId ? 'تعديل الفاتورة' : 'حفظ وترحيل الفاتورة'}</button>
           </div>
         </div>
      )}

      <div className="space-y-4">
         {filteredInvoices.map((inv: PurchaseInvoice) => (
            <div key={inv.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
               <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                       <FileText className="w-6 h-6" />
                     </div>
                     <div>
                        <h4 className="font-black text-slate-800 text-lg flex items-center gap-2">
                           المورد: {inv.supplierName || 'غير معروف'}
                           {inv.invoiceNumber && <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded font-bold">#{inv.invoiceNumber}</span>}
                        </h4>
                        <p className="text-xs text-slate-500 font-bold mt-1">تاريخ الفاتورة: {inv.date} • ({inv.items?.length || 0} صنف)</p>
                     </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                     <div className="flex-shrink-0">
                        {inv.paymentStatus === 'paid' ? (
                           <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded font-bold">مدفوعة</span>
                        ) : inv.paymentStatus === 'partial' ? (
                           <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded font-bold">مدفوعة جزئياً</span>
                        ) : (
                           <span className="bg-rose-100 text-rose-700 text-xs px-2 py-1 rounded font-bold">غير مدفوعة</span>
                        )}
                     </div>
                     <div className="text-right flex-shrink-0">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">إجمالي الفاتورة</p>
                        <p className="font-black text-xl text-rose-600 leading-none">{inv.totalAmount?.toLocaleString()} <span className="text-xs">د.ج</span></p>
                     </div>
                     <div className="flex gap-2 print:hidden">
                        <button onClick={() => setViewInvoice(inv)} className="text-indigo-600 hover:text-white border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5">
                           <Eye className="w-4 h-4" />
                           عرض
                        </button>
                        <button onClick={() => handleOpenAddSubInvoice(inv)} className="text-emerald-600 hover:text-white border border-emerald-200 bg-emerald-50 hover:bg-emerald-600 px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5" title="إنشاء فاتورة فرعية">
                           <FileText className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEditInvoice(inv)} className="text-slate-500 hover:text-white border border-slate-200 bg-slate-50 hover:bg-slate-600 px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5" title="تعديل الفاتورة">
                           <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteInvoiceClick(inv.id)} className="text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 p-2 rounded-xl transition-colors border border-slate-200 hover:border-rose-200" title="حذف الفاتورة">
                           <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
               </div>
               
               {inv.subInvoices && inv.subInvoices.length > 0 && (
                 <div className="mt-4 pt-4 border-t border-slate-100 pl-4 pr-12 print:hidden">
                   <h5 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="m18 15-6-6-6 6"/></svg>
                     الفواتير الفرعية المقتطعة من هذه الفاتورة ({inv.subInvoices.length})
                   </h5>
                   <div className="space-y-2">
                     {inv.subInvoices.map((sub: any) => (
                       <div key={sub.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                             <FileText className="w-4 h-4" />
                           </div>
                           <div>
                             <p className="text-sm font-bold text-slate-800">{sub.subInvoiceNumber}</p>
                             <p className="text-[10px] font-bold text-slate-500">{sub.date} • {sub.items?.length || 0} صنف</p>
                           </div>
                         </div>
                         <div className="flex items-center gap-4">
                           <div className="text-right">
                              <p className="font-black text-rose-600 text-sm">{sub.totalAmount?.toLocaleString()} د.ج</p>
                              <p className={`text-[10px] font-bold ${sub.paymentStatus === 'paid' ? 'text-emerald-600' : sub.paymentStatus === 'partial' ? 'text-amber-600' : 'text-rose-600'}`}>
                                {sub.paymentStatus === 'paid' ? 'مدفوعة' : sub.paymentStatus === 'partial' ? 'مدفوعة جزئياً' : 'غير مدفوعة'}
                              </p>
                           </div>
                           <div className="flex gap-1.5">
                             <button onClick={() => setViewSubInvoice({mainInvId: inv.id, mainInvNo: inv.invoiceNumber, supplierName: inv.supplierName || 'غير معروف', subInv: sub})} className="p-1.5 bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-100 rounded-lg transition-colors">
                               <Eye className="w-3.5 h-3.5" />
                             </button>
                             <button onClick={() => handleDeleteSubInvoice(inv, sub.id)} className="p-1.5 bg-white text-rose-500 hover:bg-rose-50 border border-rose-100 rounded-lg transition-colors">
                               <Trash2 className="w-3.5 h-3.5" />
                             </button>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
         ))}

         {filteredInvoices.length === 0 && !isAdding && (
          <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
             <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
             <p className="text-slate-500 font-bold">لم يتم العثور على أي فواتير شراء</p>
          </div>
        )}
      </div>

      {addingSubInvoiceFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                   <FileText className="w-5 h-5" />
                 </div>
                 <div>
                    <h3 className="font-black text-slate-800 text-lg">إنشاء فاتورة فرعية (اقتطاع)</h3>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">من الفاتورة #{addingSubInvoiceFor.invoiceNumber || addingSubInvoiceFor.id.slice(0,8)} - المورد: {addingSubInvoiceFor.supplierName}</p>
                 </div>
              </div>
              <button 
                onClick={() => setAddingSubInvoiceFor(null)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shadow-sm border border-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
               
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الفاتورة الفرعية</label>
                   <input type="date" value={subInvoiceData.date ?? ''} onChange={e => setSubInvoiceData({...subInvoiceData, date: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1.5">حالة الدفع</label>
                   <select value={subInvoiceData.paymentStatus ?? 'unpaid'} onChange={e => setSubInvoiceData({...subInvoiceData, paymentStatus: e.target.value as any})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors bg-white">
                     <option value="unpaid">غير مدفوعة (دين)</option>
                     <option value="paid">مدفوعة بالكامل</option>
                     <option value="partial">مدفوعة جزئياً</option>
                   </select>
                 </div>
                 <div className="md:col-span-2">
                   <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات الدفع</label>
                   <input type="text" value={subInvoiceData.paymentStatus !== 'unpaid' ? (subInvoiceData.paymentNotes ?? '') : ''} disabled={subInvoiceData.paymentStatus === 'unpaid'} onChange={e => setSubInvoiceData({...subInvoiceData, paymentNotes: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:bg-slate-50" placeholder="مبلغ الدفعة، رقم الشيك..." />
                 </div>
               </div>

               <div>
                 <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                   <PackagePlus className="w-5 h-5 text-emerald-500" />
                   الأصناف المقتطعة للفاتورة الفرعية
                 </h4>
                 <div className="bg-amber-50 text-amber-700 text-xs p-3 rounded-xl mb-3 border border-amber-200 font-bold">
                   يمكنك تعديل الكمية أو السعر للأصناف. إذا قمت بوضع الكمية 0، لن يتم تضمين الصنف في الفاتورة الفرعية.
                 </div>
                 <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-right">
                       <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                             <th className="px-4 py-3 font-bold text-slate-600">رمز SKU</th>
                             <th className="px-4 py-3 font-bold text-slate-600">اسم المنتج</th>
                             <th className="px-4 py-3 font-bold text-slate-600 w-28 text-center">الكمية</th>
                             <th className="px-4 py-3 font-bold text-slate-600 w-36 text-center">التكلفة (د.ج)</th>
                             <th className="px-4 py-3 font-bold text-slate-600 w-36 text-center">الإجمالي</th>
                             <th className="px-4 py-3 font-bold text-slate-600 w-10"></th>
                          </tr>
                       </thead>
                       <tbody>
                          {subInvoiceItems.map((item) => (
                            <tr key={item.id} className={`border-b border-slate-100 last:border-0 ${item.quantity === 0 ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                              <td className="p-2 relative font-mono text-xs">{item.sku}</td>
                              <td className="p-2 font-bold text-slate-800">{item.productName}</td>
                              <td className="p-2">
                                <input type="number" min="0" value={item.quantity ?? ''} onChange={e => updateSubItem(item.id, 'quantity', Number(e.target.value))} className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 font-black text-center text-emerald-700 outline-none focus:border-emerald-500" />
                              </td>
                              <td className="p-2">
                                <input type="number" min="0" value={item.unitCost ?? ''} onChange={e => updateSubItem(item.id, 'unitCost', Number(e.target.value))} className="w-full border-2 border-slate-200 rounded-lg px-2 py-1.5 font-bold text-center text-slate-700 outline-none focus:border-emerald-500" />
                              </td>
                              <td className="p-2 font-black text-rose-600 text-center">
                                {item.totalCost.toLocaleString()}
                              </td>
                              <td className="p-2 text-center">
                                <button onClick={() => setSubInvoiceItems(subInvoiceItems.filter(i => i.id !== item.id))} className="text-slate-400 hover:text-rose-500 rounded p-1"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200 gap-4">
                   <div className="flex items-center gap-3">
                     <label className="text-sm font-bold text-slate-600">مصاريف إضافية للفاتورة:</label>
                     <div className="relative">
                       <input type="number" min="0" value={subInvoiceData.additionalExpenses || ''} onChange={e => setSubInvoiceData({...subInvoiceData, additionalExpenses: Number(e.target.value)})} className="w-32 border-2 border-slate-200 rounded-lg px-3 py-1.5 font-black text-slate-700 outline-none focus:border-emerald-500 text-left pr-8" placeholder="0" />
                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">د.ج</span>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="font-bold text-slate-600">إجمالي الفاتورة الفرعية:</span>
                     <span className="text-2xl font-black text-indigo-700">
                       {(subInvoiceItems.reduce((s,i) => s + (i.quantity > 0 ? i.totalCost : 0), 0) + Number(subInvoiceData.additionalExpenses)).toLocaleString()} د.ج
                     </span>
                   </div>
                 </div>
                 
                 <div className="mt-4">
                   <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات الفاتورة الفرعية</label>
                   <input type="text" value={subInvoiceData.notes ?? ''} onChange={e => setSubInvoiceData({...subInvoiceData, notes: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-colors" placeholder="ملاحظات إضافية..." />
                 </div>
               </div>

            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button onClick={() => setAddingSubInvoiceFor(null)} className="px-6 py-2 border border-slate-300 text-slate-600 font-bold rounded-xl transition-colors hover:bg-slate-100">إلغاء</button>
               <button onClick={handleSaveSubInvoice} className="px-8 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-sm">حفظ الفاتورة الفرعية</button>
            </div>
          </div>
        </div>
      )}

      {viewSubInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div id="printable-sub-invoice" className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                   <FileText className="w-5 h-5" />
                 </div>
                 <div>
                    <h3 className="font-black text-slate-800 text-lg">تفاصيل الفاتورة الفرعية</h3>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">#{viewSubInvoice.subInv.subInvoiceNumber} - مقتطعة من الرئيسية #{viewSubInvoice.mainInvNo}</p>
                 </div>
              </div>
              <button 
                onClick={() => setViewSubInvoice(null)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shadow-sm border border-slate-200 print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <div className="text-xs font-bold text-slate-400 mb-1">المورد</div>
                     <div className="font-black text-slate-800">{viewSubInvoice.supplierName}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <div className="text-xs font-bold text-slate-400 mb-1">التاريخ</div>
                     <div className="font-black text-slate-800">{viewSubInvoice.subInv.date}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <div className="text-xs font-bold text-slate-400 mb-1">حالة الدفع</div>
                     <div className={`font-black ${viewSubInvoice.subInv.paymentStatus === 'paid' ? 'text-emerald-600' : viewSubInvoice.subInv.paymentStatus === 'partial' ? 'text-amber-600' : 'text-rose-600'}`}>
                        {viewSubInvoice.subInv.paymentStatus === 'paid' ? 'مدفوعة بالكامل' : viewSubInvoice.subInv.paymentStatus === 'partial' ? 'مدفوعة جزئياً' : 'غير مدفوعة'}
                     </div>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                     <div className="text-xs font-bold text-rose-500 mb-1">المجموع الكلي</div>
                     <div className="font-black text-rose-700 text-xl">{viewSubInvoice.subInv.totalAmount?.toLocaleString()} <span className="text-xs">د.ج</span></div>
                  </div>
               </div>

               <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                 <PackagePlus className="w-5 h-5 text-emerald-500" />
                 قائمة السلع والكميات المشتراة (فرعية)
               </h4>

               <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                  <table className="w-full text-right text-sm">
                     <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                           <th className="px-4 py-3 font-bold">الرقم</th>
                           <th className="px-4 py-3 font-bold">رمز SKU</th>
                           <th className="px-4 py-3 font-bold">السلعة</th>
                           <th className="px-4 py-3 font-bold text-center">الكمية</th>
                           <th className="px-4 py-3 font-bold text-center">سعر الوحدة</th>
                           <th className="px-4 py-3 font-bold text-left">الإجمالي</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {viewSubInvoice.subInv.items?.map((item: any, index: number) => (
                           <tr key={index} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-400">{index + 1}</td>
                              <td className="px-4 py-3 font-mono text-xs text-slate-500"><span className="bg-slate-100 rounded px-2 py-0.5">{item.sku || '-'}</span></td>
                              <td className="px-4 py-3 font-bold text-slate-800">{item.productName || 'غير معروف'}</td>
                              <td className="px-4 py-3 font-black text-emerald-600 bg-emerald-50 rounded text-center">+{item.quantity}</td>
                              <td className="px-4 py-3 font-bold text-slate-600 text-center">{item.unitCost?.toLocaleString()} د.ج</td>
                              <td className="px-4 py-3 font-black text-indigo-600 text-left">{item.totalCost?.toLocaleString()} د.ج</td>
                           </tr>
                        ))}
                     </tbody>
                     <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
                        {viewSubInvoice.subInv.additionalExpenses > 0 && (
                          <tr>
                             <td colSpan={5} className="px-4 py-3 font-bold text-slate-600 text-left">مصاريف إضافية :</td>
                             <td className="px-4 py-3 font-bold text-rose-500 text-left">{viewSubInvoice.subInv.additionalExpenses?.toLocaleString()} د.ج</td>
                          </tr>
                        )}
                        <tr>
                           <td colSpan={5} className="px-4 py-4 font-black text-slate-700 text-left text-lg">المجموع الكلي للفاتورة الفرعية :</td>
                           <td className="px-4 py-4 font-black text-rose-600 text-xl text-left">{viewSubInvoice.subInv.totalAmount?.toLocaleString()} د.ج</td>
                        </tr>
                     </tfoot>
                  </table>
               </div>
               
               {viewSubInvoice.subInv.notes && (
                 <div className="mt-6 bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <h5 className="text-xs font-bold text-amber-600 mb-1">ملاحظات الفاتورة</h5>
                    <p className="text-sm font-medium text-amber-800">{viewSubInvoice.subInv.notes}</p>
                 </div>
               )}
               {viewSubInvoice.subInv.paymentNotes && viewSubInvoice.subInv.paymentStatus !== 'unpaid' && (
                 <div className="mt-4 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <h5 className="text-xs font-bold text-emerald-600 mb-1">ملاحظات الدفع</h5>
                    <p className="text-sm font-medium text-emerald-800">{viewSubInvoice.subInv.paymentNotes}</p>
                 </div>
               )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 print:hidden">
               <button 
                 onClick={() => triggerPrint({ printableElementId: 'printable-sub-invoice', title: `فاتورة_فرعية_${viewSubInvoice.subInv.subInvoiceNumber || viewSubInvoice.subInv.id}` })} 
                 className="px-6 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
               >
                 <Printer className="w-4 h-4 text-emerald-600" />
                 طباعة الفاتورة الفرعية
               </button>
               <button onClick={() => setViewSubInvoice(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {viewInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div id="printable-purchase-invoice" className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                   <FileText className="w-5 h-5" />
                 </div>
                 <div>
                    <h3 className="font-black text-slate-800 text-lg">تفاصيل فاتورة الشراء</h3>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">#{viewInvoice.invoiceNumber || viewInvoice.id.slice(0,8)}</p>
                 </div>
              </div>
              <button 
                onClick={() => setViewInvoice(null)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shadow-sm border border-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <div className="text-xs font-bold text-slate-400 mb-1">المورد</div>
                     <div className="font-black text-slate-800">{viewInvoice.supplierName || 'غير محدد'}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <div className="text-xs font-bold text-slate-400 mb-1">التاريخ</div>
                     <div className="font-black text-slate-800">{viewInvoice.date}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <div className="text-xs font-bold text-slate-400 mb-1">عدد الأصناف</div>
                     <div className="font-black text-slate-800">{viewInvoice.items?.length || 0} صنف</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <div className="text-xs font-bold text-slate-400 mb-1">حالة الدفع</div>
                     <div className={`font-black ${viewInvoice.paymentStatus === 'paid' ? 'text-emerald-600' : viewInvoice.paymentStatus === 'partial' ? 'text-amber-600' : 'text-rose-600'}`}>
                        {viewInvoice.paymentStatus === 'paid' ? 'مدفوعة بالكامل' : viewInvoice.paymentStatus === 'partial' ? 'مدفوعة جزئياً' : 'غير مدفوعة'}
                     </div>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                     <div className="text-xs font-bold text-rose-500 mb-1">المجموع الكلي</div>
                     <div className="font-black text-rose-700 text-xl">{viewInvoice.totalAmount?.toLocaleString()} <span className="text-xs">د.ج</span></div>
                  </div>
               </div>

               <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                 <PackagePlus className="w-5 h-5 text-indigo-500" />
                 قائمة السلع والكميات المشتراة
               </h4>

               <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-sm">
                     <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                           <th className="px-4 py-3 font-bold">الرقم</th>
                           <th className="px-4 py-3 font-bold">رمز SKU</th>
                           <th className="px-4 py-3 font-bold">السلعة</th>
                           <th className="px-4 py-3 font-bold text-center">الكمية</th>
                           <th className="px-4 py-3 font-bold">سعر الوحدة</th>
                           <th className="px-4 py-3 font-bold">الإجمالي</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {viewInvoice.items?.map((item, index) => (
                           <tr key={index} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-400">{index + 1}</td>
                              <td className="px-4 py-3 font-mono text-xs text-slate-500"><span className="bg-slate-100 rounded px-2 py-0.5">{item.sku || '-'}</span></td>
                              <td className="px-4 py-3 font-bold text-slate-800">{item.productName || 'غير معروف'}</td>
                              <td className="px-4 py-3 font-black text-emerald-600 bg-emerald-50 rounded text-center">+{item.quantity}</td>
                              <td className="px-4 py-3 font-bold text-slate-600">{item.unitCost?.toLocaleString()} د.ج</td>
                              <td className="px-4 py-3 font-black text-indigo-600">{item.totalCost?.toLocaleString()} د.ج</td>
                           </tr>
                        ))}
                     </tbody>
                     <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
                        <tr>
                           <td colSpan={5} className="px-4 py-4 font-black text-slate-700 text-left">المجموع الكلي للفاتورة :</td>
                           <td className="px-4 py-4 font-black text-rose-600 text-lg">{viewInvoice.totalAmount?.toLocaleString()} د.ج</td>
                        </tr>
                     </tfoot>
                  </table>
               </div>
               
               {viewInvoice.notes && (
                 <div className="mt-6 bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <h5 className="text-xs font-bold text-amber-600 mb-1">ملاحظات الفاتورة</h5>
                    <p className="text-sm font-medium text-amber-800">{viewInvoice.notes}</p>
                 </div>
               )}
               {viewInvoice.paymentNotes && viewInvoice.paymentStatus !== 'unpaid' && (
                 <div className="mt-4 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <h5 className="text-xs font-bold text-emerald-600 mb-1">ملاحظات الدفع</h5>
                    <p className="text-sm font-medium text-emerald-800">{viewInvoice.paymentNotes}</p>
                 </div>
               )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 print:hidden">
               <button 
                 onClick={() => triggerPrint({ printableElementId: 'printable-purchase-invoice', title: `فاتورة_شراء_${viewInvoice.invoiceNumber || viewInvoice.id.slice(0,8)}` })} 
                 className="px-6 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
               >
                 <Printer className="w-4 h-4 text-emerald-600" />
                 طباعة الفاتورة
               </button>
               <button onClick={() => setViewInvoice(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
