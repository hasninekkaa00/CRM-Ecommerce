import React, { useState, useMemo } from 'react';
import { X, Scale, ArrowLeftRight, CheckCircle2, AlertCircle, DollarSign, User, Sparkles, Percent, Plus } from 'lucide-react';
import { Partner, PartnerTransaction } from '../../types';
import toast from 'react-hot-toast';

interface SettlementCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  partners: Partner[];
  transactions: PartnerTransaction[];
  onOpenQuickSettlement: (sourcePartnerId: string, targetPartnerId: string, amount: number) => void;
}

export function SettlementCalculatorModal({
  isOpen,
  onClose,
  partners,
  transactions,
  onOpenQuickSettlement
}: SettlementCalculatorModalProps) {
  const [includeInitialCapital, setIncludeInitialCapital] = useState(true);
  const [includeWithdrawals, setIncludeWithdrawals] = useState(true);

  // Calculate contributions and withdrawals for all partners
  const stats = useMemo(() => {
    return partners.map(p => {
      let contributed = 0;
      let withdrawn = 0;

      if (includeInitialCapital && p.initialCapital) {
        contributed += p.initialCapital;
      }

      transactions.forEach(t => {
        if (t.partnerId === p.id) {
          if (t.type === 'withdrawal') {
            withdrawn += t.amount;
          } else if (t.type === 'partner_settlement') {
            // دفع لشريك آخر = يعتبر مساهمة ودفع
            contributed += t.amount;
          } else {
            // contribution, ad_spend, goods_purchase, shipping_expense, operational_expense, other
            contributed += t.amount;
          }
        }

        // If this partner received a settlement from another partner
        if (t.targetPartnerId === p.id && t.type === 'partner_settlement') {
          withdrawn += t.amount; // استلم تسوية = يعتبر استرد جزءاً من أمواله
        }
      });

      const netInvested = includeWithdrawals ? (contributed - withdrawn) : contributed;

      return {
        partner: p,
        contributed,
        withdrawn,
        netInvested,
        share: p.sharePercentage || (100 / (partners.length || 1))
      };
    });
  }, [partners, transactions, includeInitialCapital, includeWithdrawals]);

  if (!isOpen) return null;

  const totalPool = stats.reduce((sum, s) => sum + s.netInvested, 0);

  // Calculate target contribution based on share percentage
  const enriched = stats.map(s => {
    const targetContribution = (totalPool * (s.share / 100));
    const balanceDifference = s.netInvested - targetContribution; // positive: paid more (creditor), negative: paid less (debtor)
    return {
      ...s,
      targetContribution,
      balanceDifference
    };
  });

  // Calculate pairwise settlement transfers
  // Separating creditors and debtors
  const creditors = enriched.filter(e => e.balanceDifference > 1).map(c => ({ ...c, remaining: c.balanceDifference }));
  const debtors = enriched.filter(e => e.balanceDifference < -1).map(d => ({ ...d, remaining: Math.abs(d.balanceDifference) }));

  const settlementTransfers: {
    fromPartner: Partner;
    toPartner: Partner;
    amount: number;
  }[] = [];

  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];
    const transferAmount = Math.min(creditor.remaining, debtor.remaining);

    if (transferAmount > 0) {
      settlementTransfers.push({
        fromPartner: debtor.partner,
        toPartner: creditor.partner,
        amount: Math.round(transferAmount)
      });
    }

    creditor.remaining -= transferAmount;
    debtor.remaining -= transferAmount;

    if (creditor.remaining < 1) cIdx++;
    if (debtor.remaining < 1) dIdx++;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">
                حاسبة تصفية وتسوية الحسابات بين الشركاء
              </h3>
              <p className="text-xs text-slate-500">
                مقارنة ما دفعه كل شريك من رأس مال، إعلانات وسلع لتسوية الحسابات بدقة
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

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Options toggle */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeInitialCapital}
                onChange={(e) => setIncludeInitialCapital(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-700">احتساب رأس المال الافتتاحي</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeWithdrawals}
                onChange={(e) => setIncludeWithdrawals(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-700">خصم المسحوبات الشخصية السابقة</span>
            </label>
          </div>

          {partners.length < 2 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
              <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">تحتاج إلى شريكين على الأقل لتفعيل حاسبة التسوية</p>
              <p className="text-xs text-slate-400 mt-1">أضف شريكك في التجارة للبدء في تصفية الحسابات آلياً</p>
            </div>
          ) : (
            <>
              {/* Partner Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {enriched.map(item => (
                  <div 
                    key={item.partner.id} 
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-sm">
                          {item.partner.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{item.partner.name}</div>
                          <div className="text-[11px] text-slate-500">نسبة الشراكة: {item.share}%</div>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        item.balanceDifference > 1 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : item.balanceDifference < -1 
                          ? 'bg-rose-100 text-rose-800' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.balanceDifference > 1 ? 'دفع أكثر من حصته' : item.balanceDifference < -1 ? 'دفع أقل من حصته' : 'الحساب متوازن'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>إجمالي ما دفعه وساهم به:</span>
                        <strong className="font-mono text-emerald-700">{item.contributed.toLocaleString()} د.ج</strong>
                      </div>
                      {includeWithdrawals && (
                        <div className="flex justify-between text-slate-600">
                          <span>المسحوبات الشخصية:</span>
                          <strong className="font-mono text-rose-700">{item.withdrawn.toLocaleString()} د.ج</strong>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-800 font-bold pt-1.5 border-t border-slate-100">
                        <span>صافي المساهمة الفعلية:</span>
                        <span className="font-mono text-indigo-700">{item.netInvested.toLocaleString()} د.ج</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>المفروض حسب نسبته ({item.share}%):</span>
                        <span className="font-mono">{Math.round(item.targetContribution).toLocaleString()} د.ج</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Settlement Recommendations Box */}
              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-bold text-indigo-950 text-sm">
                    النتيجة وخطة التسوية لتصفية الحسابات تماماً
                  </h4>
                </div>

                {settlementTransfers.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-white p-3 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>الحسابات متوازنة تماماً بين الشركاء وفقاً للنسب المحددة!</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-indigo-900 leading-relaxed">
                      لكي تتطابق مساهمات الشركاء الفعلية مع نسب الشراكة المتفق عليها، يُرجى إجراء التحويلات التالية:
                    </p>

                    {settlementTransfers.map((st, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">
                              على <strong className="text-rose-600">{st.fromPartner.name}</strong> دفع مبلغ{' '}
                              <span className="text-indigo-700 font-mono text-base font-black px-1.5 py-0.5 bg-indigo-50 rounded-md">
                                {st.amount.toLocaleString()} د.ج
                              </span>{' '}
                              إلى <strong className="text-emerald-600">{st.toPartner.name}</strong>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              لتصفية الفارق بين مصاريف ومساهمات الشريكين
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenQuickSettlement(st.fromPartner.id, st.toPartner.id, st.amount);
                          }}
                          className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          تسجيل دفعة التسوية الآن
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
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
