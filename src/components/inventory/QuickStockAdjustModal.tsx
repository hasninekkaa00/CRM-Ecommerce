import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, ArrowRightLeft, Package, CheckCircle2, AlertCircle, Calendar, Truck } from 'lucide-react';
import { useStore } from '../../store';
import { calculateShippedStock } from '../../utils/inventoryCalc';
import toast from 'react-hot-toast';

interface QuickStockAdjustModalProps {
  onClose: () => void;
  preSelectedProductId?: string;
  preSelectedVariationId?: string;
}

export function QuickStockAdjustModal({ onClose, preSelectedProductId, preSelectedVariationId }: QuickStockAdjustModalProps) {
  const { inventoryProducts, orders, recordStockAdjustment } = useStore();

  const [selectedProductId, setSelectedProductId] = useState<string>(preSelectedProductId || (inventoryProducts?.[0]?.id || ''));
  const [selectedVariationId, setSelectedVariationId] = useState<string>(preSelectedVariationId || '');
  const [actionType, setActionType] = useState<'add' | 'subtract' | 'set'>('add');
  const [qtyValue, setQtyValue] = useState<number>(1);
  const [deductShipping, setDeductShipping] = useState<boolean>(true);
  const [reasonType, setReasonType] = useState<string>('تعديل يدوي');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedProduct = inventoryProducts.find(p => p.id === selectedProductId);
  const variations = selectedProduct?.variations || [];

  const selectedVariation = variations.find(
    (v: any) => v.id === selectedVariationId || `${selectedProduct?.id}-${v.name}` === selectedVariationId
  );

  const currentStock = selectedVariation
    ? Number(selectedVariation.local_stock_quantity ?? selectedVariation.stock_quantity ?? selectedVariation.quantity ?? 0)
    : selectedProduct
    ? Number(selectedProduct.local_stock_quantity ?? selectedProduct.stock_quantity ?? selectedProduct.quantity ?? 0)
    : 0;

  // Calculate shipped quantity for this product/variation
  const shippedQty = useMemo(() => {
    if (!selectedProduct) return 0;
    if (selectedVariation) {
      return calculateShippedStock(selectedVariation, false, selectedProduct, orders);
    }
    return calculateShippedStock(selectedProduct, true, selectedProduct, orders);
  }, [selectedProduct, selectedVariation, orders]);

  // Target stock calculation taking into account shipped orders if enabled
  const effectiveTargetStock = (() => {
    if (actionType === 'set') {
      if (deductShipping && shippedQty > 0) {
        return qtyValue - shippedQty;
      }
      return qtyValue;
    }
    return qtyValue;
  })();

  const calculatedNewStock = (() => {
    if (actionType === 'add') return currentStock + qtyValue;
    if (actionType === 'subtract') return currentStock - qtyValue;
    if (actionType === 'set') return effectiveTargetStock;
    return currentStock;
  })();

  const calculatedChangeQty = (() => {
    if (actionType === 'add') return qtyValue;
    if (actionType === 'subtract') return -qtyValue;
    if (actionType === 'set') return effectiveTargetStock - currentStock;
    return 0;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedProduct) {
      toast.error('يرجى اختيار المنتج أولاً');
      return;
    }

    if (calculatedChangeQty === 0) {
      toast.error('لم يتم تغيير أي كمية');
      return;
    }

    try {
      setIsSubmitting(true);
      const fullReason = note ? `${reasonType} - ${note}` : reasonType;

      await recordStockAdjustment({
        productId: selectedProductId,
        variationId: selectedVariationId || null,
        changeQty: calculatedChangeQty,
        typeName: fullReason,
        note: note || reasonType
      });

      toast.success('تم تحديث المخزن وتسجيل الحركة بنجاح!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحديث المخزون');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white w-full max-w-lg max-h-[85vh] sm:max-h-[88vh] my-auto rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 px-6 py-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
              <Package className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h3 className="text-lg font-black">إضافة / تعديل كمية المخزن</h3>
              <p className="text-xs text-indigo-200 font-medium">تعديل المخزون يدوياً مع حفظ السجل بالتاريخ</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-5">
          
          {/* Select Product */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">اختر المنتج</label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                setSelectedVariationId('');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            >
              {inventoryProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(SKU: ${p.sku})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Select Variation if available */}
          {variations.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">اختر النوع / العرض (اختياري)</label>
              <select
                value={selectedVariationId}
                onChange={(e) => setSelectedVariationId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              >
                <option value="">-- المنتج الرئيسي بجميع أنواعه --</option>
                {variations.map((v: any) => {
                  const vId = v.id || `${selectedProduct?.id}-${v.name}`;
                  const vName = v.name || v.attributes?.map((a: any) => a.option).join(' ');
                  return (
                    <option key={vId} value={vId}>
                      {vName} {v.sku ? `(${v.sku})` : ''} - [الكمية: {v.local_stock_quantity ?? v.stock_quantity ?? 0}]
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Current Stock Banner */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">المخزون الحالي بالمستودع</span>
            <div className="flex items-center gap-2">
              {shippedQty > 0 && (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-amber-600" /> {shippedQty} في حالة (تم الشحن)
                </span>
              )}
              <span className="text-xl font-black text-slate-800 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-sm">
                {currentStock} <span className="text-xs font-normal text-slate-400">قطعة</span>
              </span>
            </div>
          </div>

          {/* Shipped Orders Deduction Option */}
          {shippedQty > 0 && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-amber-600" />
                  خصم الطلبيات في حالة (تم الشحن) ({shippedQty} قطعة)
                </span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deductShipping}
                    onChange={(e) => setDeductShipping(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-amber-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
              <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                {deductShipping
                  ? `سيتم خصم ${shippedQty} قطعة (في حالة تم الشحن) من الكمية عند التعيين (المتبقي الفعلي بالمخزن = ${actionType === 'set' ? (qtyValue - shippedQty) : calculatedNewStock} ${(actionType === 'set' ? (qtyValue - shippedQty) : calculatedNewStock) < 0 ? '(عجز)' : 'قطعة'}).`
                  : `لن يتم خصم طلبيات (تم الشحن). ستُعتمد الكمية المدخلة (${qtyValue}) مباشرة كرصيد متوفر بالمستودع.`}
              </p>
            </div>
          )}

          {/* Action Types Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">نوع العملية</label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setActionType('add')}
                className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  actionType === 'add'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus className="w-4 h-4" /> إضافة (+)
              </button>
              <button
                type="button"
                onClick={() => setActionType('subtract')}
                className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  actionType === 'subtract'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Minus className="w-4 h-4" /> خصم (-)
              </button>
              <button
                type="button"
                onClick={() => setActionType('set')}
                className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  actionType === 'set'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" /> تعيين كمية (=)
              </button>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {actionType === 'add' && 'الكمية المراد إضافتها'}
              {actionType === 'subtract' && 'الكمية المراد خصمها'}
              {actionType === 'set' && 'الكمية الجديدة الكلية'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={qtyValue}
                onChange={(e) => setQtyValue(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white text-center transition-all"
              />
            </div>
          </div>

          {/* New Stock Preview */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" /> الكمية الجديدة بعد التعديل
            </span>
            <span className="text-2xl font-black text-indigo-700">
              {calculatedNewStock} <span className="text-xs font-medium text-indigo-400">قطعة</span>
            </span>
          </div>

          {/* Reason / Note */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">سبب التعديل</label>
              <select
                value={reasonType}
                onChange={(e) => setReasonType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="تعديل يدوي">تعديل يدوي عادي</option>
                <option value="استلام بضاعة جديدة">استلام بضاعة جديدة</option>
                <option value="تعديل جرد المخزن">تعديل جرد المخزن</option>
                <option value="منتج تالف / مفقود">منتج تالف / مفقود</option>
                <option value="تسوية شحنة مرجعة">تسوية شحنة مرجعة</option>
                <option value="عينات / هدايا">عينات / هدايا</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">ملاحظة إضافية (اختياري)</label>
              <input
                type="text"
                placeholder="أدخل أي تفاصيل أخرى..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              تأكيد وتحديث المخزن
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 px-5 rounded-xl transition-all text-sm"
            >
              إلغاء
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
