import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Users, DollarSign, CreditCard, ArrowLeftRight, Megaphone, Package, Truck, 
  Building2, Search, Filter, Calendar, Download, Trash2, Edit2, FileText, 
  ArrowUpRight, ArrowDownLeft, Scale, CheckCircle2, AlertCircle, Eye, RefreshCw, 
  Wallet, Tag, ExternalLink, Sparkles
} from 'lucide-react';
import { useStore } from '../../store';
import { Partner, PartnerTransaction, PartnerTransactionType, ViewState } from '../../types';
import { PartnerModal } from './PartnerModal';
import { TransactionModal } from './TransactionModal';
import { PartnerStatementModal } from './PartnerStatementModal';
import { SettlementCalculatorModal } from './SettlementCalculatorModal';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { TablePagination } from '../common/TablePagination';

interface ExpensesManagerProps {
  onViewChange?: (view: ViewState) => void;
}

export function ExpensesManager({ onViewChange }: ExpensesManagerProps) {
  const { 
    partners, 
    partnerTransactions, 
    deletePartner, 
    deletePartnerTransaction 
  } = useStore();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'partners'>('overview');

  // Modals state
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<PartnerTransaction | null>(null);
  const [defaultTxPartnerId, setDefaultTxPartnerId] = useState<string | undefined>(undefined);
  const [defaultTxType, setDefaultTxType] = useState<PartnerTransactionType | undefined>(undefined);
  const [defaultTxAmount, setDefaultTxAmount] = useState<number | undefined>(undefined);
  const [defaultTxDesc, setDefaultTxDesc] = useState<string | undefined>(undefined);

  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [selectedStatementPartner, setSelectedStatementPartner] = useState<Partner | null>(null);

  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{
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

  // Filters for Transactions Table
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'this_month' | 'last_month' | 'custom'>(() => {
    return (localStorage.getItem('expenses_dateFilter') as any) || 'all';
  });

  useEffect(() => {
    localStorage.setItem('expenses_dateFilter', dateFilter);
  }, [dateFilter]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calculate comprehensive metrics
  const partnerStats = useMemo(() => {
    return partners.map(p => {
      const pTransactions = partnerTransactions.filter(t => t.partnerId === p.id || t.targetPartnerId === p.id);
      
      let initialCapital = p.initialCapital || 0;
      let contributions = 0;
      let adSpend = 0;
      let goodsPurchases = 0;
      let shipping = 0;
      let operational = 0;
      let otherExpenses = 0;
      let withdrawals = 0;
      let settlementsPaid = 0;
      let settlementsReceived = 0;

      pTransactions.forEach(t => {
        if (t.partnerId === p.id) {
          if (t.type === 'contribution') contributions += t.amount;
          else if (t.type === 'ad_spend') adSpend += t.amount;
          else if (t.type === 'goods_purchase') goodsPurchases += t.amount;
          else if (t.type === 'shipping_expense') shipping += t.amount;
          else if (t.type === 'operational_expense') operational += t.amount;
          else if (t.type === 'other') otherExpenses += t.amount;
          else if (t.type === 'withdrawal') withdrawals += t.amount;
          else if (t.type === 'partner_settlement') settlementsPaid += t.amount;
        }

        if (t.targetPartnerId === p.id && t.type === 'partner_settlement') {
          settlementsReceived += t.amount;
        }
      });

      // Total money this partner brought in or paid for the business
      const totalContributed = initialCapital + contributions + adSpend + goodsPurchases + shipping + operational + otherExpenses + settlementsPaid;
      // Total money this partner took out or received as settlement
      const totalWithdrawn = withdrawals + settlementsReceived;
      // Net remaining balance
      const netBalance = totalContributed - totalWithdrawn;

      return {
        partner: p,
        initialCapital,
        contributions,
        adSpend,
        goodsPurchases,
        shipping,
        operational,
        otherExpenses,
        withdrawals,
        settlementsPaid,
        settlementsReceived,
        totalContributed,
        totalWithdrawn,
        netBalance,
        transactionsCount: pTransactions.length
      };
    });
  }, [partners, partnerTransactions]);

  // Overall Global Business Totals
  const overallStats = useMemo(() => {
    let totalInitial = 0;
    let totalCapitalInjected = 0;
    let totalAdSpend = 0;
    let totalGoodsPurchased = 0;
    let totalShippingPaid = 0;
    let totalOperational = 0;
    let totalOtherExp = 0;
    let totalWithdrawals = 0;

    partners.forEach(p => {
      totalInitial += (p.initialCapital || 0);
    });

    partnerTransactions.forEach(t => {
      if (t.type === 'contribution') totalCapitalInjected += t.amount;
      else if (t.type === 'ad_spend') totalAdSpend += t.amount;
      else if (t.type === 'goods_purchase') totalGoodsPurchased += t.amount;
      else if (t.type === 'shipping_expense') totalShippingPaid += t.amount;
      else if (t.type === 'operational_expense') totalOperational += t.amount;
      else if (t.type === 'other') totalOtherExp += t.amount;
      else if (t.type === 'withdrawal') totalWithdrawals += t.amount;
    });

    const totalDirectExpensesPaid = totalAdSpend + totalGoodsPurchased + totalShippingPaid + totalOperational + totalOtherExp;
    const grandTotalInjected = totalInitial + totalCapitalInjected + totalDirectExpensesPaid;
    const netCurrentBalance = grandTotalInjected - totalWithdrawals;

    return {
      totalInitial,
      totalCapitalInjected,
      totalDirectExpensesPaid,
      totalAdSpend,
      totalGoodsPurchased,
      totalShippingPaid,
      totalOperational,
      totalWithdrawals,
      grandTotalInjected,
      netCurrentBalance
    };
  }, [partners, partnerTransactions]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return partnerTransactions.filter(t => {
      // Partner filter
      if (selectedPartnerFilter !== 'all') {
        if (t.partnerId !== selectedPartnerFilter && t.targetPartnerId !== selectedPartnerFilter) {
          return false;
        }
      }

      // Type filter
      if (selectedTypeFilter !== 'all' && t.type !== selectedTypeFilter) {
        return false;
      }

      // Date filter
      if (dateFilter === 'today') {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        if (!t.date.startsWith(todayStr)) return false;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        if (t.date < sevenDaysAgo) return false;
      } else if (dateFilter === 'this_month') {
        const monthStr = format(new Date(), 'yyyy-MM');
        if (!t.date.startsWith(monthStr)) return false;
      } else if (dateFilter === 'last_month') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthStr = format(lastMonth, 'yyyy-MM');
        if (!t.date.startsWith(lastMonthStr)) return false;
      } else if (dateFilter === 'custom') {
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchDesc = (t.description || '').toLowerCase().includes(term);
        const matchNotes = (t.notes || '').toLowerCase().includes(term);
        const matchPartner = (t.partnerName || '').toLowerCase().includes(term);
        const matchTarget = (t.targetPartnerName || '').toLowerCase().includes(term);
        const matchAmount = String(t.amount).includes(term);
        if (!matchDesc && !matchNotes && !matchPartner && !matchTarget && !matchAmount) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [partnerTransactions, selectedPartnerFilter, selectedTypeFilter, dateFilter, startDate, endDate, searchTerm]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('expenses_pageSize');
    return saved ? Number(saved) : 25;
  });

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    localStorage.setItem('expenses_pageSize', String(newSize));
    setCurrentPage(1);
  };

  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPartnerFilter, selectedTypeFilter, dateFilter, startDate, endDate, searchTerm]);

  // Export filtered transactions to Excel
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      toast.error('لا توجد عمليات للتصدير');
      return;
    }

    const dataToExport = filteredTransactions.map((t, idx) => {
      const typeLabel = 
        t.type === 'contribution' ? 'ضخ رأس مال' :
        t.type === 'withdrawal' ? 'سحب شخصي / أرباح' :
        t.type === 'ad_spend' ? 'إعلانات ممولة' :
        t.type === 'goods_purchase' ? 'شراء بضاعة' :
        t.type === 'shipping_expense' ? 'مصاريف شحن' :
        t.type === 'operational_expense' ? 'مصاريف تشغيلية' :
        t.type === 'partner_settlement' ? 'تسوية بين الشركاء' : 'أخرى';

      return {
        '#': idx + 1,
        'التاريخ': t.date,
        'الشريك': t.partnerName,
        'النوع': typeLabel,
        'المبلغ (د.ج)': t.amount,
        'البيان': t.description,
        'طريقة الدفع': t.paymentMethod || 'كاش',
        'المستلم في التسوية': t.targetPartnerName || '-',
        'ملاحظات': t.notes || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل_المصاريف_والشراكة');
    XLSX.writeFile(workbook, `سجل_المصاريف_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('تم تصدير ملف Excel بنجاح');
  };

  const openAddTransactionForPartner = (partnerId: string, type?: PartnerTransactionType) => {
    setEditingTx(null);
    setDefaultTxPartnerId(partnerId);
    setDefaultTxType(type || 'contribution');
    setIsTxModalOpen(true);
  };

  const openQuickSettlement = (fromPartnerId: string, toPartnerId: string, amount: number) => {
    const fromPartner = partners.find(p => p.id === fromPartnerId);
    const toPartner = partners.find(p => p.id === toPartnerId);
    
    setEditingTx({
      id: '',
      partnerId: fromPartnerId,
      partnerName: fromPartner ? fromPartner.name : '',
      targetPartnerId: toPartnerId,
      targetPartnerName: toPartner ? toPartner.name : '',
      amount: amount,
      date: format(new Date(), 'yyyy-MM-dd'),
      type: 'partner_settlement',
      paymentMethod: 'بريدي موب (BaridiMob)',
      description: `تسوية حسابات من ${fromPartner?.name} إلى ${toPartner?.name}`,
      createdAt: new Date().toISOString()
    });
    setIsTxModalOpen(true);
  };

  const handleDeletePartner = (p: Partner) => {
    setDeleteModal({
      isOpen: true,
      title: `حذف الشريك: ${p.name}`,
      message: `هل أنت متأكد من حذف الشريك "${p.name}"؟ لن يتم حذف العمليات المالية المسجلة سابقاً.`,
      onConfirm: async () => {
        try {
          await deletePartner(p.id);
          toast.success('تم حذف الشريك بنجاح');
          setDeleteModal(prev => ({ ...prev, isOpen: false }));
        } catch (e) {
          toast.error('فشل حذف الشريك');
        }
      }
    });
  };

  const handleDeleteTransaction = (t: PartnerTransaction) => {
    setDeleteModal({
      isOpen: true,
      title: 'حذف العملية المالية',
      message: `هل أنت متأكد من حذف حركة "${t.description}" بمبلغ ${t.amount.toLocaleString()} د.ج؟`,
      onConfirm: async () => {
        try {
          await deletePartnerTransaction(t.id);
          toast.success('تم حذف العملية بنجاح');
          setDeleteModal(prev => ({ ...prev, isOpen: false }));
        } catch (e) {
          toast.error('فشل حذف العملية');
        }
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                إدارة المصاريف وحسابات الشركاء
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                تنظيم مساهمات رأس المال، مدفوعات الإعلانات والسلع، المسحوبات الشخصية، وتصفية الحسابات
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              setEditingTx(null);
              setDefaultTxPartnerId(undefined);
              setDefaultTxType(undefined);
              setIsTxModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            إضافة حركة مالية
          </button>

          <button
            onClick={() => {
              setEditingPartner(null);
              setIsPartnerModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 active:scale-98 text-slate-700 text-xs sm:text-sm font-bold shadow-2xs flex items-center gap-2 transition-all"
          >
            <Users className="w-4 h-4 text-indigo-600" />
            إضافة شريك
          </button>

          <button
            onClick={() => setIsSettlementModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-98 text-emerald-800 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all"
          >
            <Scale className="w-4 h-4 text-emerald-600" />
            تصفية الحسابات
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Injected / Contributed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي ما ضخه الشركاء</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700">
            {overallStats.grandTotalInjected.toLocaleString()}{' '}
            <span className="text-xs font-medium text-slate-500">د.ج</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>رأس مال: {overallStats.totalCapitalInjected.toLocaleString()} د.ج</span>
            <span>افتتاحي: {overallStats.totalInitial.toLocaleString()} د.ج</span>
          </div>
        </div>

        {/* Direct Expenses Paid by Partners */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">مصاريف دفعها الشركاء</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-blue-700">
            {overallStats.totalDirectExpensesPaid.toLocaleString()}{' '}
            <span className="text-xs font-medium text-slate-500">د.ج</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>إعلانات: {overallStats.totalAdSpend.toLocaleString()} د.ج</span>
            <span>بضاعة: {overallStats.totalGoodsPurchased.toLocaleString()} د.ج</span>
          </div>
        </div>

        {/* Total Withdrawals by Partners */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي المسحوبات الشخصية</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-700">
            {overallStats.totalWithdrawals.toLocaleString()}{' '}
            <span className="text-xs font-medium text-slate-500">د.ج</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            أرباح ومسحوبات أخذها الشركاء من النشاط
          </div>
        </div>

        {/* Net Injected Capital (Remaining) */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs bg-linear-to-br from-indigo-50/50 to-white relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-900">صافي رصيد رأس المال الحالي</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-950">
            {overallStats.netCurrentBalance.toLocaleString()}{' '}
            <span className="text-xs font-medium text-slate-500">د.ج</span>
          </div>
          <div className="text-[11px] text-indigo-700 font-semibold mt-1">
            (إجمالي ما تم ضخه ودَفعه - المسحوبات)
          </div>
        </div>
      </div>

      {/* Partners Section: Cards Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <h3 className="font-black text-slate-800 text-base">
              حسابات الشركاء والوضع المالي الفردي ({partners.length})
            </h3>
          </div>
          {partners.length > 1 && (
            <button
              onClick={() => setIsSettlementModalOpen(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Scale className="w-3.5 h-3.5" />
              عرض حاسبة التسوية وتصفية الحسابات
            </button>
          )}
        </div>

        {partners.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">لم تقم بإضافة شركاء بعد</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              أضف نفسك وشريكك لتنظيم رأس المال ومتابعة من دفع مصاريف الإعلانات أو البضاعة وكم سحب كل شخص.
            </p>
            <button
              onClick={() => {
                setEditingPartner(null);
                setIsPartnerModalOpen(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة أول شريك
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {partnerStats.map(stat => {
              const p = stat.partner;
              const isCreditor = stat.netBalance >= 0;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Partner Header */}
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-lg">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 text-base leading-tight">{p.name}</h4>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {p.sharePercentage || 50}%
                            </span>
                          </div>
                          {p.phone && (
                            <span className="text-xs text-slate-400 font-mono" dir="ltr">{p.phone}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingPartner(p);
                            setIsPartnerModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="تعديل بيانات الشريك"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePartner(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="حذف الشريك"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Net Balance Banner */}
                    <div className={`p-3 rounded-xl border mb-4 ${
                      isCreditor 
                        ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950' 
                        : 'bg-rose-50/70 border-rose-200/80 text-rose-950'
                    }`}>
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span>{isCreditor ? 'الرصيد المتبقي له (يطلب)' : 'الرصيد المتبقي عليه (مدين)'}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          isCreditor ? 'bg-emerald-200/80 text-emerald-800' : 'bg-rose-200/80 text-rose-800'
                        }`}>
                          {isCreditor ? '✅ له في المشروع' : '⚠️ عليه للمشروع'}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div className="text-2xl font-black font-mono">
                          {Math.abs(stat.netBalance).toLocaleString()}{' '}
                          <span className="text-xs font-normal">د.ج</span>
                        </div>
                        {stat.netBalance !== 0 && (
                          <button
                            onClick={() => {
                              setSelectedStatementPartner(p); // Set default partner
                              setDefaultTxAmount(Math.abs(stat.netBalance));
                              setDefaultTxType(stat.netBalance < 0 ? 'contribution' : 'withdrawal');
                              setDefaultTxDesc('تسوية رصيد الشراكة');
                              setEditingTx(null);
                              setIsTxModalOpen(true);
                            }}
                            className={`px-2 py-1 rounded text-xs font-bold shadow-xs transition-colors ${isCreditor ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                          >
                            تسوية
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Detailed breakdown list */}
                    <div className="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                      <div className="flex justify-between">
                        <span>إجمالي ما ساهم به ودفعه:</span>
                        <strong className="font-mono text-emerald-700">{stat.totalContributed.toLocaleString()} د.ج</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>إجمالي ما أخذه وسحبه:</span>
                        <strong className="font-mono text-rose-700">{stat.totalWithdrawn.toLocaleString()} د.ج</strong>
                      </div>
                      <div className="border-t border-slate-200/60 pt-1.5 mt-1 text-[11px] text-slate-500 space-y-1">
                        {stat.adSpend > 0 && (
                          <div className="flex justify-between">
                            <span>• دفع إعلانات ممولة:</span>
                            <span className="font-mono">{stat.adSpend.toLocaleString()} د.ج</span>
                          </div>
                        )}
                        {stat.goodsPurchases > 0 && (
                          <div className="flex justify-between">
                            <span>• دفع شراء بضاعة:</span>
                            <span className="font-mono">{stat.goodsPurchases.toLocaleString()} د.ج</span>
                          </div>
                        )}
                        {stat.contributions > 0 && (
                          <div className="flex justify-between">
                            <span>• ضخ رأس مال مباشر:</span>
                            <span className="font-mono">{stat.contributions.toLocaleString()} د.ج</span>
                          </div>
                        )}
                        {stat.operational + stat.shipping + stat.otherExpenses > 0 && (
                          <div className="flex justify-between">
                            <span>• مصاريف أخرى وشحن:</span>
                            <span className="font-mono">{(stat.operational + stat.shipping + stat.otherExpenses).toLocaleString()} د.ج</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Partner Quick Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => openAddTransactionForPartner(p.id)}
                      className="flex-1 py-2 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة دفعة
                    </button>

                    <button
                      onClick={() => {
                        setSelectedStatementPartner(p);
                        setIsStatementModalOpen(true);
                      }}
                      className="flex-1 py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      كشف الحساب
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transactions & Payments Ledger Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-800 text-lg">سجل العمليات والدفعات المالية</h3>
              <p className="text-xs text-slate-500">
                عرض وفلترة جميع حركات ضخ رأس المال، مصاريف الإعلانات، السلع، والمسحوبات ({filteredTransactions.length} حركة)
              </p>
            </div>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs self-start sm:self-auto transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              تصدير السجل (Excel)
            </button>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث في البيان، الوصف، المبلغ..."
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>

            {/* Partner Filter */}
            <div>
              <select
                value={selectedPartnerFilter}
                onChange={(e) => setSelectedPartnerFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="all">جميع الشركاء</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="all">جميع أنواع العمليات</option>
                <option value="contribution">💵 ضخ رأس مال</option>
                <option value="withdrawal">💳 سحب شخصي / أرباح</option>
                <option value="ad_spend">📢 إعلانات ممولة</option>
                <option value="goods_purchase">📦 شراء بضاعة</option>
                <option value="shipping_expense">🚚 مصاريف شحن</option>
                <option value="operational_expense">🏢 مصاريف تشغيلية</option>
                <option value="partner_settlement">🔄 تسوية بين الشركاء</option>
                <option value="other">📝 أخرى</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="all">كل الأوقات</option>
                <option value="today">اليوم</option>
                <option value="7days">آخر 7 أيام</option>
                <option value="this_month">هذا الشهر</option>
                <option value="last_month">الشهر الماضي</option>
                <option value="custom">تاريخ مخصص...</option>
              </select>
            </div>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-600">من:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-1.5 bg-white border border-slate-200 rounded-lg font-mono"
              />
              <span className="font-bold text-slate-600">إلى:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-1.5 bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>
          )}
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">لا توجد عمليات تطابق البحث أو الفلاتر</p>
              <p className="text-xs text-slate-400 mt-1">انقر على "إضافة حركة مالية" لتسجيل دفعة جديدة</p>
            </div>
          ) : (
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">الشريك</th>
                  <th className="py-3 px-4">نوع العملية</th>
                  <th className="py-3 px-4">البيان والوصف</th>
                  <th className="py-3 px-4">طريقة الدفع</th>
                  <th className="py-3 px-4">المبلغ</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTransactions.map(t => {
                  const isPositive = t.type !== 'withdrawal';
                  const isSettlement = t.type === 'partner_settlement';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-800">
                        {t.partnerName}
                        {isSettlement && t.targetPartnerName && (
                          <span className="text-[11px] text-indigo-600 font-normal block">
                            إلى ➔ {t.targetPartnerName}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ${
                          t.type === 'contribution' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          t.type === 'withdrawal' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          t.type === 'ad_spend' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          t.type === 'goods_purchase' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          t.type === 'shipping_expense' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          t.type === 'operational_expense' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' :
                          t.type === 'partner_settlement' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {t.type === 'contribution' && '💵 ضخ رأس مال'}
                          {t.type === 'withdrawal' && '💳 سحب شخصي'}
                          {t.type === 'ad_spend' && '📢 إعلانات ممولة'}
                          {t.type === 'goods_purchase' && '📦 شراء بضاعة'}
                          {t.type === 'shipping_expense' && '🚚 مصاريف شحن'}
                          {t.type === 'operational_expense' && '🏢 مصاريف تشغيلية'}
                          {t.type === 'partner_settlement' && '🔄 تسوية شركاء'}
                          {t.type === 'other' && '📝 أخرى'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{t.description}</div>
                        {t.notes && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{t.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {t.paymentMethod || 'كاش'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-black text-sm">
                        <span className={
                          t.type === 'withdrawal' 
                            ? 'text-rose-600' 
                            : isSettlement 
                            ? 'text-indigo-600' 
                            : 'text-emerald-700'
                        }>
                          {t.type === 'withdrawal' ? '-' : '+'}{t.amount.toLocaleString()} د.ج
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {t.attachmentUrl && (
                            <a
                              href={t.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                              title="عرض الوصل"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setEditingTx(t);
                              setIsTxModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(t)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          pageSizeOptions={[15, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          itemLabel="حركة مالية"
        />
      </div>

      {/* Partner Modal */}
      <PartnerModal
        isOpen={isPartnerModalOpen}
        onClose={() => {
          setIsPartnerModalOpen(false);
          setEditingPartner(null);
        }}
        partner={editingPartner}
      />

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        transaction={editingTx}
        defaultPartnerId={defaultTxPartnerId}
        defaultType={defaultTxType}
        onOpenPartnerModal={() => {
          setIsTxModalOpen(false);
          setEditingPartner(null);
          setIsPartnerModalOpen(true);
        }}
      />

      {/* Partner Statement Modal */}
      <PartnerStatementModal
        isOpen={isStatementModalOpen}
        onClose={() => {
          setIsStatementModalOpen(false);
          setSelectedStatementPartner(null);
        }}
        partner={selectedStatementPartner}
        transactions={partnerTransactions}
        onOpenSettle={(partnerId, amount, type, desc) => {
          setDefaultTxAmount(amount);
          setDefaultTxType(type);
          setDefaultTxDesc(desc);
          setEditingTx(null);
          setIsTxModalOpen(true);
        }}
      />

      {/* Settlement Calculator Modal */}
      <SettlementCalculatorModal
        isOpen={isSettlementModalOpen}
        onClose={() => setIsSettlementModalOpen(false)}
        partners={partners}
        transactions={partnerTransactions}
        onOpenQuickSettlement={openQuickSettlement}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-lg">{deleteModal.title}</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{deleteModal.message}</p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={deleteModal.onConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
