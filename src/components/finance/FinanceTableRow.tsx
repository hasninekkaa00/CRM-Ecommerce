import React, { useState, useEffect } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { extractWilayaCode, isStopDeskOrder, calculateDefaultShippingFee, getEffectiveShippingCost } from '../../utils/shippingFees';

const formatCurrency = (val: number) => {
  return Math.round(Number(val) || 0).toLocaleString('fr-FR');
};

interface FinanceTableRowProps {
  order: any;
  orderCosts: { totalCogs: number; extCost: number };
  settings: any;
  isMonthlySub: boolean;
  isTableProdFiltered: boolean;
  syncingOrderId: string | null;
  onUpdateOrder: (orderId: string, updates: Partial<any>) => void;
  onSyncFinancials: (order: any) => void;
  onSingleOrderAutoShipping: (order: any) => void;
  onApplyCostGlobally: (order: any, costToApply: number) => void;
  onSelectForDetails: (order: any) => void;
  mapStatusToStatus2: (s: string, o?: any) => string;
  isHighlighted?: boolean;
}

export const FinanceTableRow = React.memo(function FinanceTableRow({
  order: o,
  orderCosts,
  settings,
  isMonthlySub,
  isTableProdFiltered,
  syncingOrderId,
  onUpdateOrder,
  onSyncFinancials,
  onSingleOrderAutoShipping,
  onApplyCostGlobally,
  onSelectForDetails,
  mapStatusToStatus2,
  isHighlighted
}: FinanceTableRowProps) {
  // Local states for inputs to guarantee 60fps instant typing without lagging the browser
  const [localTotalCharge, setLocalTotalCharge] = useState<string>(
    o.totalCharge !== undefined && o.totalCharge !== null ? String(o.totalCharge) : ''
  );
  const [localDeliveryPrice, setLocalDeliveryPrice] = useState<string>(
    o.deliveryPrice !== undefined && o.deliveryPrice !== null ? String(o.deliveryPrice) : ''
  );
  const [localRealDeliveryPrice, setLocalRealDeliveryPrice] = useState<string>(
    o.realDeliveryPrice !== undefined && o.realDeliveryPrice !== null ? String(o.realDeliveryPrice) : ''
  );
  const [localCustomProductCost, setLocalCustomProductCost] = useState<string>(
    o.customProductCost !== undefined && o.customProductCost !== null && Number(o.customProductCost) > 0
      ? String(o.customProductCost)
      : ''
  );
  const [localCustomAdditionalCost, setLocalCustomAdditionalCost] = useState<string>(
    o.customAdditionalCost !== undefined && o.customAdditionalCost !== null ? String(o.customAdditionalCost) : ''
  );
  const [localCustomReturnCost, setLocalCustomReturnCost] = useState<string>(
    o.customReturnCost !== undefined && o.customReturnCost !== null ? String(o.customReturnCost) : ''
  );

  // Sync local inputs when order props change from external source (e.g. sync from shipping or bulk apply)
  useEffect(() => {
    setLocalTotalCharge(o.totalCharge !== undefined && o.totalCharge !== null ? String(o.totalCharge) : '');
  }, [o.totalCharge]);

  useEffect(() => {
    setLocalDeliveryPrice(o.deliveryPrice !== undefined && o.deliveryPrice !== null ? String(o.deliveryPrice) : '');
  }, [o.deliveryPrice]);

  useEffect(() => {
    setLocalRealDeliveryPrice(o.realDeliveryPrice !== undefined && o.realDeliveryPrice !== null ? String(o.realDeliveryPrice) : '');
  }, [o.realDeliveryPrice]);

  useEffect(() => {
    setLocalCustomProductCost(
      o.customProductCost !== undefined && o.customProductCost !== null && Number(o.customProductCost) > 0
        ? String(o.customProductCost)
        : ''
    );
  }, [o.customProductCost]);

  useEffect(() => {
    setLocalCustomAdditionalCost(
      o.customAdditionalCost !== undefined && o.customAdditionalCost !== null ? String(o.customAdditionalCost) : ''
    );
  }, [o.customAdditionalCost]);

  useEffect(() => {
    setLocalCustomReturnCost(
      o.customReturnCost !== undefined && o.customReturnCost !== null ? String(o.customReturnCost) : ''
    );
  }, [o.customReturnCost]);

  const { totalCogs, extCost } = orderCosts;
  const realStatus = o.isExchangedReturn ? 'مستلم' : mapStatusToStatus2(o.status2 || '', o);
  const rev = Number(o.totalCharge) || 0;
  const realShp = getEffectiveShippingCost(o, settings);

  let profitType = 'متوقعة';
  let profitColor = 'text-blue-600 bg-blue-50';
  let netProfit = 0;
  let isReturned = false;

  // When product is filtered, return cost and extra expense are 0
  const effectiveExtCost = isTableProdFiltered ? 0 : extCost;
  const rawReturnCost = isMonthlySub ? 0 : (o.customReturnCost !== undefined ? o.customReturnCost : (settings?.returnCost || 400));
  const returnCostToUse = isTableProdFiltered ? 0 : rawReturnCost;

  if (realStatus === 'مستلم') {
    profitType = 'مستلمة (حقيقية)';
    profitColor = 'text-emerald-700 bg-emerald-100 border-emerald-200';
    netProfit = rev - realShp - totalCogs - effectiveExtCost;
  } else if (realStatus === 'مرتجع') {
    profitType = isMonthlySub ? 'مرتجع (مشمول بالاشتراك)' : 'مرتجع (خسارة)';
    profitColor = isMonthlySub ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-rose-700 bg-rose-100 border-rose-200';
    isReturned = true;
    netProfit = isMonthlySub ? 0 : (-returnCostToUse - effectiveExtCost);
  } else {
    profitType = 'معلقة (متوقعة)';
    profitColor = 'text-blue-700 bg-blue-100 border-blue-200';
    netProfit = rev - realShp - totalCogs - effectiveExtCost;
  }

  const hasCustom = o.customProductCost !== undefined && o.customProductCost !== null && Number(o.customProductCost) > 0;

  // Commit changes on blur to prevent heavy store re-render on every keystroke
  const commitTotalCharge = () => {
    const val = localTotalCharge === '' ? 0 : Number(localTotalCharge);
    if (val !== o.totalCharge) {
      onUpdateOrder(o.id, { totalCharge: val });
    }
  };

  const commitDeliveryPrice = () => {
    const val = localDeliveryPrice === '' ? 0 : Number(localDeliveryPrice);
    if (val !== o.deliveryPrice) {
      onUpdateOrder(o.id, { deliveryPrice: val });
    }
  };

  const commitRealDeliveryPrice = () => {
    const val = localRealDeliveryPrice === '' ? 0 : Number(localRealDeliveryPrice);
    if (val !== o.realDeliveryPrice || o.shippingFeeMode !== 'manual') {
      onUpdateOrder(o.id, { realDeliveryPrice: val, shippingFeeMode: 'manual' });
    }
  };

  const commitCustomProductCost = () => {
    const val = localCustomProductCost === '' ? undefined : Number(localCustomProductCost);
    const costToSet = (val !== undefined && val > 0) ? val : undefined;
    if (costToSet !== o.customProductCost) {
      onUpdateOrder(o.id, { customProductCost: costToSet, isCustomProductCostManual: costToSet !== undefined });
    }
  };

  const commitCustomAdditionalCost = () => {
    const val = localCustomAdditionalCost === '' ? undefined : Number(localCustomAdditionalCost);
    if (val !== o.customAdditionalCost) {
      onUpdateOrder(o.id, { customAdditionalCost: val });
    }
  };

  const commitCustomReturnCost = () => {
    const val = localCustomReturnCost === '' ? undefined : Number(localCustomReturnCost);
    if (val !== o.customReturnCost) {
      onUpdateOrder(o.id, { customReturnCost: val });
    }
  };

  return (
    <tr 
      id={`finance-order-row-${o.id || o.orderId}`}
      className={`transition-all duration-700 ${
        isHighlighted 
          ? 'bg-amber-100/90 ring-4 ring-amber-400/90 shadow-xl relative z-20 scale-[1.002]' 
          : 'hover:bg-gray-50/50'
      }`}
    >
      <td className="p-4 align-top">
        <div 
          onClick={() => onSelectForDetails(o)}
          className="font-bold text-gray-900 hover:text-indigo-600 cursor-pointer transition-colors flex items-center gap-1.5 group"
          title="اضغط لعرض تفاصيل الطلبية كاملة"
        >
          <span className="group-hover:underline">#{o.orderId}</span>
          <Eye size={13} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
        </div>
        <div className="text-xs text-slate-500 mt-1 font-mono bg-slate-100 px-1.5 py-0.5 rounded inline-block">
          {o.shippingTrackingId || 'بدون تتبع'}
        </div>
        {o.deliveryCompany && (
          <div className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mt-1 mr-1 inline-block">
            {o.deliveryCompany}
          </div>
        )}
      </td>
      <td className="p-4 align-top">
        <div 
          onClick={() => onSelectForDetails(o)}
          className="font-bold text-gray-800 hover:text-indigo-600 cursor-pointer transition-colors"
          title="اضغط لعرض تفاصيل الزبون والطلبية"
        >
          {o.fullName}
        </div>
        <div className="text-xs text-indigo-600 font-medium truncate max-w-[150px]" title={`${o.productName} (${o.variation})`}>
          {o.productName}
        </div>
        <div className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {o.sku || '-'}</div>
      </td>
      <td className="p-4 align-top text-center">
        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${profitColor}`}>
          {profitType}
        </span>
      </td>
      <td className="p-4 align-top">
        <div className="relative mb-1.5">
          <input
            type="number"
            className="w-full text-xs border border-gray-200 rounded-lg py-1 px-2 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            placeholder={formatCurrency(rev).replace(/\s/g,'')}
            value={localTotalCharge}
            onChange={(e) => setLocalTotalCharge(e.target.value)}
            onBlur={commitTotalCharge}
            onKeyDown={(e) => e.key === 'Enter' && commitTotalCharge()}
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">دخل</span>
        </div>
        <div className="relative mb-1.5">
          <input
            type="number"
            className="w-full text-xs border border-gray-200 rounded-lg py-1 px-2 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            placeholder="شحن الزبون"
            value={localDeliveryPrice}
            onChange={(e) => setLocalDeliveryPrice(e.target.value)}
            onBlur={commitDeliveryPrice}
            onKeyDown={(e) => e.key === 'Enter' && commitDeliveryPrice()}
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">زبون</span>
        </div>
        <div className="bg-amber-50/50 p-2 rounded-xl border border-amber-200/80 mb-1.5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-bold text-amber-950">سعر شركة الشحن:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-amber-100/80 border border-amber-300/80">
              <button
                type="button"
                onClick={() => onSingleOrderAutoShipping(o)}
                className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md transition-all ${
                  (!o.shippingFeeMode || o.shippingFeeMode === 'auto')
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-200/50'
                }`}
                title="تلقائي من شركة الشحن (حسب الولاية ونوع التوصيل)"
              >
                ⚡ تلقائي
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentVal = o.realDeliveryPrice !== undefined && o.realDeliveryPrice !== null && Number(o.realDeliveryPrice) >= 0
                    ? Number(o.realDeliveryPrice)
                    : calculateDefaultShippingFee(extractWilayaCode(o), isStopDeskOrder(o)).realDeliveryPrice;
                  setLocalRealDeliveryPrice(String(currentVal));
                  onUpdateOrder(o.id, {
                    shippingFeeMode: 'manual',
                    realDeliveryPrice: currentVal
                  });
                }}
                className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md transition-all ${
                  o.shippingFeeMode === 'manual'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-200/50'
                }`}
                title="تعديل يدوي لسعر الشحن"
              >
                ✏️ يدوي
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="number"
              className={`w-full text-xs rounded-lg py-1 px-2 font-black outline-none transition-all ${
                o.shippingFeeMode === 'manual'
                  ? 'border-2 border-indigo-500 bg-indigo-50/40 text-indigo-950 focus:border-indigo-600 focus:bg-white'
                  : 'border border-amber-300 bg-white text-amber-950 focus:border-amber-500'
              }`}
              placeholder={o.shippingFeeMode === 'manual' ? 'أدخل السعر يدوي...' : `تلقائي (${o.realDeliveryPrice || o.deliveryPrice || 0})`}
              value={localRealDeliveryPrice}
              onFocus={() => {
                if (o.shippingFeeMode !== 'manual') {
                  const currentVal = o.realDeliveryPrice !== undefined && o.realDeliveryPrice !== null && Number(o.realDeliveryPrice) >= 0
                    ? Number(o.realDeliveryPrice)
                    : calculateDefaultShippingFee(extractWilayaCode(o), isStopDeskOrder(o)).realDeliveryPrice;
                  setLocalRealDeliveryPrice(String(currentVal));
                  onUpdateOrder(o.id, {
                    shippingFeeMode: 'manual',
                    realDeliveryPrice: currentVal
                  });
                }
              }}
              onChange={(e) => setLocalRealDeliveryPrice(e.target.value)}
              onBlur={commitRealDeliveryPrice}
              onKeyDown={(e) => e.key === 'Enter' && commitRealDeliveryPrice()}
            />
            <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black ${
              o.shippingFeeMode === 'manual' ? 'text-indigo-600' : 'text-amber-700'
            }`}>
              {o.shippingFeeMode === 'manual' ? 'يدوي' : 'أصلي'}
            </span>
          </div>

          {(!o.shippingFeeMode || o.shippingFeeMode === 'auto') && (
            <div className="text-[9px] text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300 font-bold text-center">
              ⚡ الوضع التلقائي (شركة الشحن)
            </div>
          )}
        </div>

        {o.realDeliveryPrice !== undefined && Number(o.realDeliveryPrice) > 0 && Number(o.realDeliveryPrice) !== Number(o.deliveryPrice) && (
          <div className="text-[10px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 mb-1 font-black text-center">
            يخصم الأصلي: {o.realDeliveryPrice} دج (بدل {o.deliveryPrice || 0})
          </div>
        )}
        <button
          onClick={() => onSyncFinancials(o)}
          disabled={syncingOrderId === o.id || !o.shippingTrackingId}
          className="w-full flex items-center justify-center gap-1 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
          title="جلب القيم الحقيقية من شركة الشحن برقم التتبع"
        >
          <RefreshCw size={10} className={syncingOrderId === o.id ? 'animate-spin' : ''} />
          تحديث من الشحن
        </button>
      </td>
      <td className="p-4 align-top">
        <div className="space-y-1.5 max-w-[130px]">
          <div className="relative">
            <input
              type="number"
              className={`w-full text-sm border rounded-lg py-1.5 px-2 font-bold outline-none transition-all ${
                hasCustom
                  ? 'border-purple-300 bg-purple-50/50 text-purple-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                  : totalCogs > 0
                  ? 'border-gray-200 bg-white text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                  : 'border-rose-200 bg-rose-50/40 text-rose-800 focus:border-rose-400'
              }`}
              placeholder={formatCurrency(totalCogs).replace(/\s/g,'')}
              value={localCustomProductCost}
              onChange={(e) => setLocalCustomProductCost(e.target.value)}
              onBlur={commitCustomProductCost}
              onKeyDown={(e) => e.key === 'Enter' && commitCustomProductCost()}
            />
            <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black ${hasCustom ? 'text-purple-600' : 'text-gray-400'}`}>
              {hasCustom ? 'مخصص' : 'إجمالي'}
            </span>
          </div>

          {hasCustom ? (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-purple-700 font-bold">مخصص يدوياً</span>
              <button
                type="button"
                onClick={() => {
                  setLocalCustomProductCost('');
                  onUpdateOrder(o.id, { customProductCost: undefined, isCustomProductCostManual: false });
                }}
                className="text-gray-400 hover:text-rose-600 underline font-medium cursor-pointer"
                title="إعادة للتكلفة التلقائية"
              >
                استرجاع
              </button>
            </div>
          ) : (
            <div className="text-[10px]">
              {totalCogs > 0 ? (
                <div className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-bold text-center">
                  تلقائي: {formatCurrency(totalCogs)} دج
                </div>
              ) : (
                <div className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 font-bold text-center">
                  ⚠️ غير مسعر (0 دج)
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              const costToApply = hasCustom ? Number(o.customProductCost) : totalCogs;
              if (costToApply > 0) {
                onApplyCostGlobally(o, costToApply);
              } else {
                const promptVal = window.prompt(`أدخل تكلفة البضاعة للقطعة الواحدة للمنتج (${o.productName || o.sku || 'المنتج'}):`, '1000');
                if (promptVal && Number(promptVal) > 0) {
                  onApplyCostGlobally(o, Number(promptVal));
                }
              }
            }}
            className="w-full text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/80 py-0.5 px-1 rounded transition-colors text-center border border-indigo-100 cursor-pointer"
            title="تعميم هذه التكلفة على جميع طلبيات هذا المنتج وتحديثها في المخزن"
          >
            ⚡ تعميم التكلفة
          </button>
        </div>
      </td>
      <td className="p-4 align-top">
        <div className="space-y-2 max-w-[120px]">
          <div className="relative">
            <input
              type="number"
              className="w-full text-sm border border-gray-200 rounded-lg py-1.5 px-2 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-gray-50"
              placeholder={isTableProdFiltered ? "محيدة بالفلترة" : "إضافية..."}
              disabled={isTableProdFiltered}
              value={localCustomAdditionalCost}
              onChange={(e) => setLocalCustomAdditionalCost(e.target.value)}
              onBlur={commitCustomAdditionalCost}
              onKeyDown={(e) => e.key === 'Enter' && commitCustomAdditionalCost()}
            />
          </div>
          {isReturned && (
            isTableProdFiltered ? (
              <div className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold border border-slate-200 text-center" title="لا تحتسب مصاريف المرتجع عند فلترة منتج محدد">
                محيد بالفلترة (0 د.ج)
              </div>
            ) : isMonthlySub ? (
              <div className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200 text-center" title="تكلفة المرتجع مدفوعة ضمن الاشتراك الشهري الثابت">
                اشتراك شهري (0 د.ج)
              </div>
            ) : (
              <div className="relative">
                <input
                  type="number"
                  className="w-full text-sm border border-rose-200 rounded-lg py-1.5 px-2 font-bold focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all bg-rose-50 text-rose-700"
                  placeholder={String(settings?.returnCost || 400)}
                  value={localCustomReturnCost}
                  onChange={(e) => setLocalCustomReturnCost(e.target.value)}
                  onBlur={commitCustomReturnCost}
                  onKeyDown={(e) => e.key === 'Enter' && commitCustomReturnCost()}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-rose-400 text-[10px]">مرتجع</span>
              </div>
            )
          )}
        </div>
      </td>
      <td className="p-4 align-top">
        <span className={`text-lg font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
        </span>
      </td>
      <td className="p-4 align-top text-center">
        <button
          type="button"
          onClick={() => onSelectForDetails(o)}
          className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center border border-transparent hover:border-indigo-100"
          title="عرض التفاصيل الكاملة للطلبية (الزبون، المنتج، المالية، التتبع)"
        >
          <Eye size={18} />
        </button>
      </td>
    </tr>
  );
});
