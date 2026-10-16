import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { AppUser, ConfirmerInvoice, ConfirmerCommissionConfig, ConfirmerCommissionType } from '../../types';
import { 
  Wallet, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Eye, 
  Printer, 
  Trash2, 
  Edit3, 
  Save, 
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Search,
  Calendar
} from 'lucide-react';

interface ConfirmerFinanceManagerProps {
  defaultShowInvoicesList?: boolean;
  onOpenInvoiceModal: (confirmer?: AppUser) => void;
  onViewBreakdown: (confirmer: AppUser) => void;
  onPrintInvoice?: (invoice: ConfirmerInvoice) => void;
}

export const ConfirmerFinanceManager: React.FC<ConfirmerFinanceManagerProps> = ({
  defaultShowInvoicesList = false,
  onOpenInvoiceModal,
  onViewBreakdown,
  onPrintInvoice
}) => {
  const { users, orders, settings, setSettings, updateUser, confirmerInvoices, deleteConfirmerInvoice } = useStore();

  const [activeSubView, setActiveSubView] = useState<'balances' | 'invoices'>(defaultShowInvoicesList ? 'invoices' : 'balances');
  const [editingCommissionUser, setEditingCommissionUser] = useState<AppUser | null>(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  const confirmers = useMemo(() => {
    return users.filter(u => u.role === 'confirmer' || u.isActive);
  }, [users]);

  // Global default commission config
  const globalDefaultCommission: ConfirmerCommissionConfig = settings?.assignmentSettings?.defaultCommission || {
    type: 'per_confirmed',
    ratePerAssigned: 10,
    ratePerConfirmed: 50,
    ratePerDelivered: 100,
    fixedMonthlySalary: 0
  };

  const [globalCommissionForm, setGlobalCommissionForm] = useState<ConfirmerCommissionConfig>(globalDefaultCommission);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);

  const handleSaveGlobalCommission = async () => {
    try {
      setIsSavingGlobal(true);
      const updatedSettings = {
        ...(settings || {
          status1Options: [],
          status2Options: [],
          deliveryCompanies: [],
          confirmers: []
        }),
        assignmentSettings: {
          ...(settings?.assignmentSettings || {
            enabled: true,
            defaultStrategy: 'round_robin',
            autoAssignOnImport: false,
            allowSelfClaim: true,
            rules: []
          }),
          defaultCommission: globalCommissionForm
        }
      };
      await setSettings(updatedSettings);
      alert('تم حفظ خطة العمولات العامة بنجاح');
    } catch (e) {
      console.error(e);
      alert('فشل حفظ خطة العمولات');
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const handleSaveUserCommission = async (user: AppUser, config: ConfirmerCommissionConfig) => {
    try {
      await updateUser(user.id, { commissionConfig: config });
      setEditingCommissionUser(null);
      alert(`تم تحديث عمولة ${user.displayName} بنجاح`);
    } catch (e) {
      console.error(e);
      alert('فشل تحديث العمولة');
    }
  };

  // Financial summary calculations per confirmer
  const balancesData = useMemo(() => {
    return confirmers.map(confirmer => {
      const config = confirmer.commissionConfig || globalDefaultCommission;
      
      // All orders assigned to this confirmer
      const userOrders = orders.filter(o => 
        o.assignedTo === confirmer.id || 
        o.confirmedBy === confirmer.displayName || 
        o.assignedToName === confirmer.displayName
      );

      // Unpaid orders (for calculation)
      const unpaidOrders = userOrders.filter(o => !o.isPaidToConfirmer);

      let unpaidAssignedCount = 0;
      let unpaidConfirmedCount = 0;
      let unpaidDeliveredCount = 0;

      unpaidOrders.forEach(o => {
        unpaidAssignedCount++;
        const s1 = o.status1 || '';
        const s2 = o.status2 || '';
        if (s1 === 'مؤكد' || s1.includes('مؤكد')) unpaidConfirmedCount++;
        if (s2 === 'مستلم' || s2.includes('مستلم') || s2.includes('تم التوصيل')) unpaidDeliveredCount++;
      });

      let totalAssignedCount = 0;
      let totalConfirmedCount = 0;
      let totalDeliveredCount = 0;

      userOrders.forEach(o => {
        totalAssignedCount++;
        const s1 = o.status1 || '';
        const s2 = o.status2 || '';
        if (s1 === 'مؤكد' || s1.includes('مؤكد')) totalConfirmedCount++;
        if (s2 === 'مستلم' || s2.includes('مستلم') || s2.includes('تم التوصيل')) totalDeliveredCount++;
      });

      // Calculate unpaid balance
      let unpaidBalance = 0;
      if (config.type === 'per_assigned') {
        unpaidBalance = unpaidAssignedCount * (config.ratePerAssigned || 0);
      } else if (config.type === 'per_confirmed') {
        unpaidBalance = unpaidConfirmedCount * (config.ratePerConfirmed || 0);
      } else if (config.type === 'per_delivered') {
        unpaidBalance = unpaidDeliveredCount * (config.ratePerDelivered || 0);
      } else if (config.type === 'hybrid') {
        unpaidBalance = (unpaidAssignedCount * (config.ratePerAssigned || 0)) +
                        (unpaidConfirmedCount * (config.ratePerConfirmed || 0)) +
                        (unpaidDeliveredCount * (config.ratePerDelivered || 0));
      }

      // Past paid invoices for this user
      const userInvoices = confirmerInvoices.filter(inv => inv.confirmerId === confirmer.id && inv.status === 'paid');
      const totalPaidAmount = userInvoices.reduce((sum, inv) => sum + (inv.finalTotal || 0), 0);

      return {
        confirmer,
        config,
        unpaidAssignedCount,
        unpaidConfirmedCount,
        unpaidDeliveredCount,
        totalAssignedCount,
        totalConfirmedCount,
        totalDeliveredCount,
        unpaidBalance,
        totalPaidAmount,
        invoicesCount: userInvoices.length
      };
    });
  }, [confirmers, orders, confirmerInvoices, globalDefaultCommission]);

  // Overall Global Financial Stats
  const overallFinancialStats = useMemo(() => {
    const totalUnpaid = balancesData.reduce((acc, item) => acc + item.unpaidBalance, 0);
    const totalPaid = balancesData.reduce((acc, item) => acc + item.totalPaidAmount, 0);
    const totalInvoicesCount = confirmerInvoices.length;

    return {
      totalUnpaid,
      totalPaid,
      totalAllTime: totalUnpaid + totalPaid,
      totalInvoicesCount
    };
  }, [balancesData, confirmerInvoices]);

  // Filtered past invoices list
  const filteredInvoices = useMemo(() => {
    return confirmerInvoices.filter(inv => {
      if (!invoiceSearchQuery.trim()) return true;
      const q = invoiceSearchQuery.toLowerCase();
      return (
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.confirmerName?.toLowerCase().includes(q) ||
        inv.notes?.toLowerCase().includes(q)
      );
    });
  }, [confirmerInvoices, invoiceSearchQuery]);

  const handleDeleteInvoice = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إعادة فتح الطلبيات المشمولة واحتسابها كمستحقات غير مدفوعة.')) return;
    try {
      setDeletingInvoiceId(id);
      await deleteConfirmerInvoice(id);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حذف الفاتورة');
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const formatCommissionTypeName = (type: ConfirmerCommissionType) => {
    switch (type) {
      case 'per_assigned': return 'حسب الطلبيات المسندة';
      case 'per_confirmed': return 'حسب الطلبيات المؤكدة';
      case 'per_delivered': return 'حسب الطلبيات المستلمة';
      case 'hybrid': return 'نظام مركب (تأكيد + تسليم)';
      case 'fixed_monthly': return 'راتب شهري ثابت';
      default: return type;
    }
  };

  return (
    <div id="confirmer-finance-manager-section" className="space-y-6">
      {/* Top Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold">المستحقات غير المدفوعة</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {overallFinancialStats.totalUnpaid.toLocaleString()} دج
          </div>
          <div className="text-xs text-slate-400 mt-1">جاهزة للصرف والتحرير</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold">إجمالي المسدد سابقاً</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {overallFinancialStats.totalPaid.toLocaleString()} دج
          </div>
          <div className="text-xs text-slate-400 mt-1">عبر فواتير وسندات سداد</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold">إجمالي عمولات الفريق</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-700">
            {overallFinancialStats.totalAllTime.toLocaleString()} دج
          </div>
          <div className="text-xs text-slate-400 mt-1">المسدد + المستحق</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold">عدد الفواتير الصادرة</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {overallFinancialStats.totalInvoicesCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">سجل السداد التاريخي</div>
        </div>
      </div>

      {/* Sub-view Switch Buttons */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveSubView('balances')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeSubView === 'balances' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💰 كشف حساب وأرصدة المؤكدين
          </button>
          <button
            onClick={() => setActiveSubView('invoices')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeSubView === 'invoices' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🧾 أرشيف فواتير وسداد المستحقات ({confirmerInvoices.length})
          </button>
        </div>

        <button
          onClick={() => onOpenInvoiceModal()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>تحرير فاتورة سداد جديدة</span>
        </button>
      </div>

      {/* VIEW 1: Balances and Commission Scheme Management */}
      {activeSubView === 'balances' && (
        <div className="space-y-6">
          {/* Confirmer Balances Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-800">أرصدة ومستحقات المؤكدين الحالية</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  حساب المستحقات غير المدفوعة تلقائياً وفقاً لخطة عمولة كل مؤكد
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                {balancesData.length} مؤكد
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">المؤكد</th>
                    <th className="py-3 px-3">نظام العمولة</th>
                    <th className="py-3 px-3 text-center">المسندة (غير مدفوعة)</th>
                    <th className="py-3 px-3 text-center">المؤكدة (غير مدفوعة)</th>
                    <th className="py-3 px-3 text-center">المستلمة (غير مدفوعة)</th>
                    <th className="py-3 px-4 text-center">الرصيد المستحق الدفع</th>
                    <th className="py-3 px-4 text-center">المدفوع سابقاً</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balancesData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        لا يوجد مؤكدون مسجلون في النظام
                      </td>
                    </tr>
                  ) : (
                    balancesData.map(({ confirmer, config, unpaidAssignedCount, unpaidConfirmedCount, unpaidDeliveredCount, unpaidBalance, totalPaidAmount }) => {
                      const isEditing = editingCommissionUser?.id === confirmer.id;

                      return (
                        <React.Fragment key={confirmer.id}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                  {confirmer.displayName.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800">{confirmer.displayName}</div>
                                  <div className="text-xs text-slate-400 font-normal">{confirmer.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {formatCommissionTypeName(config.type)}
                              </span>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {config.type === 'per_confirmed' && `${config.ratePerConfirmed} دج/تأكيد`}
                                {config.type === 'per_delivered' && `${config.ratePerDelivered} دج/تسليم`}
                                {config.type === 'per_assigned' && `${config.ratePerAssigned} دج/إسناد`}
                                {config.type === 'hybrid' && `${config.ratePerConfirmed} دج مؤكد + ${config.ratePerDelivered} دج مستلم`}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-medium text-slate-700">
                              {unpaidAssignedCount}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-600">
                              {unpaidConfirmedCount}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-blue-600">
                              {unpaidDeliveredCount}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="text-sm font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                {unpaidBalance.toLocaleString()} دج
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-emerald-700">
                              {totalPaidAmount.toLocaleString()} دج
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => onViewBreakdown(confirmer)}
                                  title="عرض كشف الطلبيات غير المدفوعة"
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingCommissionUser(isEditing ? null : { ...confirmer })}
                                  title="تعديل خطة العمولة المخصصة"
                                  className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-all"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => onOpenInvoiceModal(confirmer)}
                                  title="تحرير فاتورة سداد"
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  <span>سداد</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Inline Custom Commission Editor */}
                          {isEditing && (
                            <tr className="bg-indigo-50/40">
                              <td colSpan={8} className="p-4 border-t border-indigo-100">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="font-bold text-indigo-900 text-xs">
                                      تخصيص خطة العمولة لـ: {confirmer.displayName}
                                    </div>
                                    <button 
                                      onClick={() => setEditingCommissionUser(null)}
                                      className="text-xs text-slate-500 hover:text-slate-800"
                                    >
                                      إلغاء
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <label className="block text-slate-600 font-bold mb-1">طريقة الحساب</label>
                                      <select
                                        value={config.type}
                                        onChange={(e) => {
                                          const t = e.target.value as ConfirmerCommissionType;
                                          setEditingCommissionUser(prev => prev ? ({
                                            ...prev,
                                            commissionConfig: { ...(prev.commissionConfig || globalDefaultCommission), type: t }
                                          }) : null);
                                        }}
                                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                                      >
                                        <option value="per_confirmed">حسب الطلبيات المؤكدة</option>
                                        <option value="per_delivered">حسب الطلبيات المستلمة (Livré)</option>
                                        <option value="per_assigned">حسب الطلبيات المسندة</option>
                                        <option value="hybrid">نظام مركب (تأكيد + تسليم)</option>
                                        <option value="fixed_monthly">راتب شهري ثابت</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-slate-600 font-bold mb-1">سعر التأكيد (دج)</label>
                                      <input
                                        type="number"
                                        value={config.ratePerConfirmed || 0}
                                        onChange={(e) => {
                                          const v = Number(e.target.value);
                                          setEditingCommissionUser(prev => prev ? ({
                                            ...prev,
                                            commissionConfig: { ...(prev.commissionConfig || globalDefaultCommission), ratePerConfirmed: v }
                                          }) : null);
                                        }}
                                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-slate-600 font-bold mb-1">سعر الاستلام/التسليم (دج)</label>
                                      <input
                                        type="number"
                                        value={config.ratePerDelivered || 0}
                                        onChange={(e) => {
                                          const v = Number(e.target.value);
                                          setEditingCommissionUser(prev => prev ? ({
                                            ...prev,
                                            commissionConfig: { ...(prev.commissionConfig || globalDefaultCommission), ratePerDelivered: v }
                                          }) : null);
                                        }}
                                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-slate-600 font-bold mb-1">سعر الإسناد (دج)</label>
                                      <input
                                        type="number"
                                        value={config.ratePerAssigned || 0}
                                        onChange={(e) => {
                                          const v = Number(e.target.value);
                                          setEditingCommissionUser(prev => prev ? ({
                                            ...prev,
                                            commissionConfig: { ...(prev.commissionConfig || globalDefaultCommission), ratePerAssigned: v }
                                          }) : null);
                                        }}
                                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex justify-end pt-2">
                                    <button
                                      onClick={() => handleSaveUserCommission(confirmer, editingCommissionUser.commissionConfig || globalDefaultCommission)}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                      <span>حفظ الخطة المخصصة</span>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Global Default Commission Scheme Editor */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">خطة العمولات العامة الافتراضية</h3>
              </div>
              <span className="text-xs text-slate-400">تطبق تلقائياً على المؤكدين الذين ليس لديهم خطة خاصة</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">طريقة الحساب الافتراضية</label>
                <select
                  value={globalCommissionForm.type}
                  onChange={(e) => setGlobalCommissionForm(prev => ({ ...prev, type: e.target.value as ConfirmerCommissionType }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-medium"
                >
                  <option value="per_confirmed">حسب الطلبيات المؤكدة (Per Confirmed)</option>
                  <option value="per_delivered">حسب الطلبيات المستلمة (Per Delivered)</option>
                  <option value="per_assigned">حسب الطلبيات المسندة (Per Assigned)</option>
                  <option value="hybrid">نظام مركب (تأكيد + تسليم)</option>
                  <option value="fixed_monthly">راتب شهري ثابت</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">عمولة الطلبية المؤكدة (دج)</label>
                <input
                  type="number"
                  value={globalCommissionForm.ratePerConfirmed}
                  onChange={(e) => setGlobalCommissionForm(prev => ({ ...prev, ratePerConfirmed: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">عمولة الطلبية المستلمة (دج)</label>
                <input
                  type="number"
                  value={globalCommissionForm.ratePerDelivered}
                  onChange={(e) => setGlobalCommissionForm(prev => ({ ...prev, ratePerDelivered: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">عمولة الطلبية المسندة (دج)</label>
                <input
                  type="number"
                  value={globalCommissionForm.ratePerAssigned}
                  onChange={(e) => setGlobalCommissionForm(prev => ({ ...prev, ratePerAssigned: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveGlobalCommission}
                disabled={isSavingGlobal}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-xs"
              >
                <Save className="w-4 h-4" />
                <span>حفظ الخطة العامة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Invoices and Payout History Archive */}
      {activeSubView === 'invoices' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-4 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">أرشيف فواتير وسندات سداد المؤكدين</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                سجل الفواتير المصدرة مع إمكانية المعاينة، الطباعة، وتتبع الطلبيات المسددة
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="بحث برقم الفاتورة، الاسم..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">المؤكد</th>
                  <th className="py-3 px-3">الفترة الزمنية</th>
                  <th className="py-3 px-3 text-center">الطلبيات</th>
                  <th className="py-3 px-3 text-center">المبلغ الأساسي</th>
                  <th className="py-3 px-3 text-center">بونص / خصم</th>
                  <th className="py-3 px-4 text-center">المبلغ الصافي</th>
                  <th className="py-3 px-3 text-center">الحالة</th>
                  <th className="py-3 px-3 text-center">تاريخ الإصدار</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      لا توجد فواتير صادرة حتى الآن
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {invoice.confirmerName}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500">
                        {invoice.periodFrom} إلى {invoice.periodTo}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {invoice.includedOrderIds?.length || 0}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600">
                        {invoice.baseAmount?.toLocaleString()} دج
                      </td>
                      <td className="py-3 px-3 text-center text-xs">
                        {invoice.bonusAmount > 0 && <span className="text-emerald-600 block">+{invoice.bonusAmount}</span>}
                        {invoice.deductionAmount > 0 && <span className="text-rose-600 block">-{invoice.deductionAmount}</span>}
                        {!invoice.bonusAmount && !invoice.deductionAmount && <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-emerald-700 text-sm">
                        {invoice.finalTotal?.toLocaleString()} دج
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                          invoice.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {invoice.status === 'paid' ? 'تم الدفع' : invoice.status === 'pending' ? 'معلق' : 'مسودة'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-slate-400">
                        {new Date(invoice.createdAt).toLocaleDateString('ar-DZ')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onPrintInvoice && onPrintInvoice(invoice)}
                            title="معاينة وطباعة الفاتورة"
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-all"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice.id)}
                            disabled={deletingInvoiceId === invoice.id}
                            title="حذف الفاتورة وإعادة فتح الطلبيات"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
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
      )}
    </div>
  );
};
