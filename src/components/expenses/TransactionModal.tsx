import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Tag, CreditCard, FileText, User, ArrowLeftRight, Megaphone, Package, Truck, Building2, Plus, Sparkles, Link as LinkIcon } from 'lucide-react';
import { PartnerTransaction, PartnerTransactionType, Partner } from '../../types';
import { useStore } from '../../store';
import toast from 'react-hot-toast';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: PartnerTransaction | null;
  defaultPartnerId?: string;
  defaultType?: PartnerTransactionType;
  defaultAmount?: number;
  defaultDescription?: string;
  onOpenPartnerModal?: () => void;
}

const TRANSACTION_TYPES: {
  id: PartnerTransactionType;
  label: string;
  sublabel: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  impactText: string;
  impactType: 'in' | 'out' | 'transfer';
}[] = [
  {
    id: 'contribution',
    label: 'ضخ رأس مال',
    sublabel: 'إيداع نقدي لتمويل المشروع',
    icon: DollarSign,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    impactText: '+ يزيد رصيد مساهمة الشريك',
    impactType: 'in'
  },
  {
    id: 'withdrawal',
    label: 'سحب شخصي / أرباح',
    sublabel: 'أخذ أموال من التجارة',
    icon: CreditCard,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    impactText: '- يسجل كمسحوبات على الشريك',
    impactType: 'out'
  },
  {
    id: 'ad_spend',
    label: 'دفع إعلانات ممولة',
    sublabel: 'دفع إعلانات Facebook / TikTok من جيبه',
    icon: Megaphone,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    impactText: '+ يسجل كمصروف مدفوع من الشريك',
    impactType: 'in'
  },
  {
    id: 'goods_purchase',
    label: 'شراء بضاعة وسلع',
    sublabel: 'دفع فاتورة سلع للمخزن من جيبه',
    icon: Package,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    impactText: '+ يسجل كمصروف مدفوع من الشريك',
    impactType: 'in'
  },
  {
    id: 'shipping_expense',
    label: 'مصاريف شحن وتوصيل',
    sublabel: 'دفع فواتير التوصيل من جيبه',
    icon: Truck,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    impactText: '+ يسجل كمصروف مدفوع من الشريك',
    impactType: 'in'
  },
  {
    id: 'operational_expense',
    label: 'مصاريف تشغيلية',
    sublabel: 'إيجار، رواتب، تغليف، برامج...',
    icon: Building2,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    impactText: '+ يسجل كمصروف مدفوع من الشريك',
    impactType: 'in'
  },
  {
    id: 'partner_settlement',
    label: 'تسوية / تحويل لشريك',
    sublabel: 'دفع مباشر لتصفية الحساب بين شريكين',
    icon: ArrowLeftRight,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    impactText: '⇄ تسوية مباشرة بين الشركاء',
    impactType: 'transfer'
  },
  {
    id: 'other',
    label: 'أخرى',
    sublabel: 'أية حركة مالية أخرى',
    icon: Tag,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    impactText: 'حركة مالية عامة',
    impactType: 'in'
  },
];

const QUICK_SUGGESTIONS: Record<PartnerTransactionType, string[]> = {
  contribution: ['ضخ رأس مال للصندوق', 'مساهمة نقدية أولية', 'تمويل إضافي للنشاط', 'إيداع نقدي في الحساب'],
  withdrawal: ['سحب أرباح أسبوعية', 'مسحوبات شخصية', 'أخذ دفعة من الأرباح', 'سحب مصاريف خاصة'],
  ad_spend: ['شحن إعلانات فيسبوك (Facebook Ads)', 'شحن إعلانات تيك توك (TikTok Ads)', 'تمويل حملة إعلانية ممولة', 'إعلانات جوجل / إنستغرام'],
  goods_purchase: ['شراء دفعة بضاعة جديدة', 'تسديد فاتورة مورد سلع', 'شراء مواد أولية ومنتجات', 'عربون شراء دفعة سلع'],
  shipping_expense: ['تسديد فاتورة شركة التوصيل', 'دفع مصاريف إرجاع الطرود', 'شحن بضاعة بين الولايات', 'توصيل عاجل'],
  operational_expense: ['إيجار المخزن / المكتب', 'رواتب المساعدين والمؤكدين', 'أكياس ومواد تغليف وكرتون', 'اشتراك برامج ومنصات', 'كهرباء وإنترنت ومصاريف مكتب'],
  partner_settlement: ['تسوية مصاريف الإعلانات', 'تسوية رصيد الشراكة بالنصف', 'تحويل تسوية حصة البضاعة', 'دفعة تصفية حسابات'],
  other: ['مصاريف متفرقة', 'تسوية رصيد', 'عمولة بنكية']
};

const PAYMENT_METHODS = [
  'كاش / نقد',
  'بريدي موب (BaridiMob)',
  'حساب بنكي / تحويل',
  'حساب بريدي (CCP)',
  'بطاقة بنكية',
  'أخرى'
];

export function TransactionModal({
  isOpen,
  onClose,
  transaction,
  defaultPartnerId,
  defaultType,
  defaultAmount,
  defaultDescription,
  onOpenPartnerModal
}: TransactionModalProps) {
  const { partners, addPartnerTransaction, updatePartnerTransaction } = useStore();

  const [partnerId, setPartnerId] = useState('');
  const [targetPartnerId, setTargetPartnerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>('');
  const [currency, setCurrency] = useState<'DZD' | 'USD'>('DZD');
  const [exchangeRate, setExchangeRate] = useState<number | ''>('');
  const [type, setType] = useState<PartnerTransactionType>('contribution');
  const [paymentMethod, setPaymentMethod] = useState('كاش / نقد');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (transaction) {
      setPartnerId(transaction.partnerId || '');
      setTargetPartnerId(transaction.targetPartnerId || '');
      setDate(transaction.date || new Date().toISOString().split('T')[0]);
      if (transaction.currency === 'USD' && transaction.originalAmount) {
        setAmount(transaction.originalAmount || '');
      } else {
        setAmount(transaction.amount || '');
      }
      setCurrency(transaction.currency || 'DZD');
      setExchangeRate(transaction.exchangeRate || '');
      setType(transaction.type || 'contribution');
      setPaymentMethod(transaction.paymentMethod || 'كاش / نقد');
      setDescription(transaction.description || '');
      setNotes(transaction.notes || '');
      setAttachmentUrl(transaction.attachmentUrl || '');
    } else {
      setPartnerId(defaultPartnerId || (partners.length > 0 ? partners[0].id : ''));
      setTargetPartnerId('');
      setDate(new Date().toISOString().split('T')[0]);
      setAmount(defaultAmount || '');
      setCurrency('DZD');
      setExchangeRate('');
      setType(defaultType || 'contribution');
      setPaymentMethod('كاش / نقد');
      setDescription(defaultDescription || '');
      setNotes('');
      setAttachmentUrl('');
    }
  }, [transaction, isOpen, defaultPartnerId, defaultType, defaultAmount, defaultDescription, partners]);

  if (!isOpen) return null;

  const currentPartner = partners.find(p => p.id === partnerId);
  const targetPartner = partners.find(p => p.id === targetPartnerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!partnerId) {
      toast.error('يرجى تحديد الشريك');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    if (type === 'partner_settlement') {
      if (!targetPartnerId) {
        toast.error('يرجى تحديد الشريك المستلم للتسوية');
        return;
      }
      if (targetPartnerId === partnerId) {
        toast.error('لا يمكن تحويل التسوية لنفس الشريك');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const selectedPartnerObj = partners.find(p => p.id === partnerId);
      const partnerName = selectedPartnerObj ? selectedPartnerObj.name : 'شريك';
      const targetPartnerName = targetPartner ? targetPartner.name : undefined;

      const finalDescription = description.trim() || 
        (type === 'partner_settlement' ? `تسوية من ${partnerName} إلى ${targetPartnerName}` :
         type === 'contribution' ? `ضخ رأس مال - ${partnerName}` :
         type === 'withdrawal' ? `مسحوبات شخصية - ${partnerName}` :
         type === 'ad_spend' ? `إعلانات ممولة - ${partnerName}` :
         type === 'goods_purchase' ? `شراء بضاعة - ${partnerName}` :
         'حركة مالية');

      let calculatedAmount = Number(amount);
      let origAmount = undefined;
      let exRate = undefined;
      
      if (currency === 'USD') {
        exRate = Number(exchangeRate) || 1;
        origAmount = Number(amount);
        calculatedAmount = origAmount * exRate;
      }

      if (transaction) {
        await updatePartnerTransaction(transaction.id, {
          partnerId,
          partnerName,
          targetPartnerId: type === 'partner_settlement' ? targetPartnerId : undefined,
          targetPartnerName: type === 'partner_settlement' ? targetPartnerName : undefined,
          date,
          amount: calculatedAmount,
          currency,
          originalAmount: origAmount,
          exchangeRate: exRate,
          type,
          paymentMethod,
          description: finalDescription,
          notes: notes.trim(),
          attachmentUrl: attachmentUrl.trim()
        });
        toast.success('تم تحديث العملية بنجاح');
      } else {
        const newTransaction: PartnerTransaction = {
          id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          partnerId,
          partnerName,
          targetPartnerId: type === 'partner_settlement' ? targetPartnerId : undefined,
          targetPartnerName: type === 'partner_settlement' ? targetPartnerName : undefined,
          date,
          amount: calculatedAmount,
          currency,
          originalAmount: origAmount,
          exchangeRate: exRate,
          type,
          paymentMethod,
          description: finalDescription,
          notes: notes.trim(),
          attachmentUrl: attachmentUrl.trim(),
          createdAt: new Date().toISOString()
        };
        await addPartnerTransaction(newTransaction);
        toast.success('تم تسجيل العملية بنجاح');
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTypeConfig = TRANSACTION_TYPES.find(t => t.id === type) || TRANSACTION_TYPES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${currentTypeConfig.bgColor} ${currentTypeConfig.color}`}>
              <currentTypeConfig.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">
                {transaction ? 'تعديل الحركة المالية' : 'تسجيل حركة مالية جديدة'}
              </h3>
              <p className="text-xs text-slate-500">
                تسجيل دفعة، مساهمة، مصروف إعلانات أو بضاعة، أو مسحوبات شريك
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Transaction Type Selector Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              نوع العملية المالية <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TRANSACTION_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      isSelected 
                        ? `${t.bgColor} ${t.borderColor} ring-2 ring-indigo-500/20 shadow-xs` 
                        : 'border-slate-200 bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className={`p-1.5 rounded-lg ${t.bgColor} ${t.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{t.label}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{t.impactText}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Partner & Target Partner Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {type === 'partner_settlement' ? 'الشريك الدافع / المحول' : 'الشريك المعني'} <span className="text-red-500">*</span>
                </label>
                {onOpenPartnerModal && (
                  <button
                    type="button"
                    onClick={onOpenPartnerModal}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    شريك جديد
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  required
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                >
                  <option value="" disabled>-- اختر الشريك --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sharePercentage || 50}%)
                    </option>
                  ))}
                </select>
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {partners.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  لا يوجد شركاء مسجلين بعد. انقر على "شريك جديد" لإضافة شريك أولاً.
                </p>
              )}
            </div>

            {type === 'partner_settlement' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الشريك المستلم (المحول إليه) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={targetPartnerId}
                    onChange={(e) => setTargetPartnerId(e.target.value)}
                    required
                    className="w-full pl-3 pr-10 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-indigo-900"
                  >
                    <option value="" disabled>-- اختر الشريك المستلم --</option>
                    {partners.filter(p => p.id !== partnerId).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sharePercentage || 50}%)
                      </option>
                    ))}
                  </select>
                  <ArrowLeftRight className="w-4 h-4 text-indigo-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  طريقة الدفع / الوسيلة
                </label>
                <div className="relative">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <CreditCard className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  المبلغ <span className="text-red-500">*</span>
                </label>
                <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrency('DZD')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${currency === 'DZD' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    د.ج
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${currency === 'USD' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    $ USD
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  required
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900"
                />
                <DollarSign className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
              
              {currency === 'USD' && (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    سعر الصرف (1 دولار = ؟ د.ج) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="مثال: 220"
                      required={currency === 'USD'}
                      className="w-full pl-3 pr-4 py-2 bg-indigo-50/50 border border-indigo-100 rounded-lg text-sm font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}
              
              {amount !== '' && Number(amount) > 0 && (
                <div className="mt-2 p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-800 font-semibold flex items-center justify-between">
                  <span>المجموع بالدينار:</span>
                  <span className="font-mono font-black text-sm">
                    {currency === 'USD' 
                      ? (Number(amount) * (Number(exchangeRate) || 0)).toLocaleString() 
                      : Number(amount).toLocaleString()} د.ج
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تاريخ العملية <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Description & Quick Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                البيان / الوصف <span className="text-slate-400 font-normal">(اختياري أو اختر اقتراح سريع)</span>
              </label>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" /> اقتراحات سريعة
              </span>
            </div>

            <div className="relative mb-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مثال: شحن إعلانات فيسبوك، شراء 100 قطعة..."
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <FileText className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS[type]?.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setDescription(sug)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    description === sug
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                      : 'bg-slate-100/70 border-slate-200 text-slate-600 hover:bg-slate-200/80 hover:text-slate-800'
                  }`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Notes & Receipt Attachment Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ملاحظات إضافية
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تفاصيل الحساب، رقم الوصل، مرجع التحويل..."
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رابط الوصل أو الفاتورة <span className="text-slate-400 font-normal">(اختياري)</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  dir="ltr"
                />
                <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                رابط صورة الوصل على Google Drive أو منصة رفع الصور.
              </p>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              {currentPartner && (
                <span>الشريك: <strong className="text-slate-800">{currentPartner.name}</strong></span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting || partners.length === 0}
                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'جاري التسجيل...' : (transaction ? 'تحديث العملية' : 'تسجيل العملية')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
