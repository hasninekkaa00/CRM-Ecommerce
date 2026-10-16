import React, { useState, useMemo } from 'react';
import { X, Plus, Package, Tag, Box, Calendar, FileText, Trash2, Edit2, ArrowUpRight, ArrowDownLeft, RefreshCcw, Check, Clock, AlertCircle, Truck, RotateCcw } from 'lucide-react';
import { useStore } from '../../store';
import { SourceChannelBadge } from '../../utils/channelUtils';
import { calculateShippedStock } from '../../utils/inventoryCalc';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface ProductStockManagementModalProps {
  product: any;
  initialVariationId?: string | null;
  onClose: () => void;
}

export function ProductStockManagementModal({ product, initialVariationId, onClose }: ProductStockManagementModalProps) {
  const { inventoryProducts, inventoryMovements, orders, salesChannels, recordStockAdjustment, updateInventoryMovement, deleteInventoryMovement } = useStore();

  // Get live product state from store
  const liveProduct = useMemo(() => {
    return inventoryProducts.find(p => p.id === product.id) || product;
  }, [inventoryProducts, product]);

  const hasVariations = Array.isArray(liveProduct.variations) && liveProduct.variations.length > 0;

  // Selected variation state
  const [selectedVarId, setSelectedVarId] = useState<string>(initialVariationId || 'all');

  // New operation form state
  const [opType, setOpType] = useState<'addition' | 'reduction' | 'adjustment'>('addition');
  const [opQty, setOpQty] = useState<number>(1);
  const [deductShipping, setDeductShipping] = useState<boolean>(true);
  const [opNote, setOpNote] = useState<string>('');
  const [opDate, setOpDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [targetVarId, setTargetVarId] = useState<string>(
    initialVariationId || (hasVariations ? liveProduct.variations[0]?.id || '' : '')
  );

  // Calculate shipped quantity for current target variation/product
  const shippedQty = useMemo(() => {
    if (!liveProduct) return 0;
    if (hasVariations && targetVarId) {
      const v = liveProduct.variations.find((x: any) => x.id === targetVarId || `${liveProduct.id}-${x.name}` === targetVarId);
      if (v) return calculateShippedStock(v, false, liveProduct, orders);
    }
    return calculateShippedStock(liveProduct, true, liveProduct, orders);
  }, [liveProduct, targetVarId, hasVariations, orders]);

  // Edit & Delete operation state
  const [editingMov, setEditingMov] = useState<any | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [deletingMov, setDeletingMov] = useState<any | null>(null);
  const [isDeletingMov, setIsDeletingMov] = useState<boolean>(false);

  // Filter movements for this product
  const productMovements = useMemo(() => {
    return (inventoryMovements || []).filter((m: any) => {
      if (m.productId !== liveProduct.id) return false;
      if (selectedVarId !== 'all' && m.variationId !== selectedVarId) return false;
      return true;
    }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inventoryMovements, liveProduct.id, selectedVarId]);

  // Calculate current stock for chosen scope
  const getCurrentStock = (varId?: string) => {
    if (varId && varId !== 'all' && hasVariations) {
      const v = liveProduct.variations.find((x: any) => x.id === varId || `${liveProduct.id}-${x.name}` === varId);
      return Number(v?.local_stock_quantity ?? v?.stock_quantity ?? 0);
    }
    if (hasVariations) {
      return liveProduct.variations.reduce((sum: number, v: any) => sum + Number(v.local_stock_quantity ?? v.stock_quantity ?? 0), 0);
    }
    return Number(liveProduct.local_stock_quantity ?? liveProduct.stock_quantity ?? liveProduct.quantity ?? 0);
  };

  const handleAddOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opQty || opQty <= 0) {
      toast.error('يرجى أدخال كمية صالحة أكبر من صفر');
      return;
    }

    try {
      let finalChangeQty = opQty;
      let typeName = 'إدخال للمخزن (إضافة)';

      if (opType === 'reduction') {
        finalChangeQty = -opQty;
        typeName = 'إخراج من المخزن (سحب/عجز)';
      } else if (opType === 'adjustment') {
        const curStock = getCurrentStock(hasVariations ? targetVarId : undefined);
        let effectiveTarget = opQty;
        if (deductShipping && shippedQty > 0) {
          effectiveTarget = opQty - shippedQty;
        }
        finalChangeQty = effectiveTarget - curStock;
        typeName = (deductShipping && shippedQty > 0)
          ? `تسوية مخزنية (خصم ${shippedQty} طرد بالشحن)`
          : 'تسوية مخزنية (تعديل مباشر)';
      }

      await recordStockAdjustment({
        productId: liveProduct.id,
        variationId: hasVariations ? (targetVarId || null) : null,
        changeQty: finalChangeQty,
        typeName,
        date: new Date(opDate).toISOString(),
        note: opNote || 'عملية مخزن جديدة'
      });

      toast.success('تم تسجيل حركة المخزن بنجاح وتحديث الكمية المتوفرة');
      setOpQty(1);
      setOpNote('');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تسجيل الحركة');
    }
  };

  const handleStartEdit = (mov: any) => {
    setEditingMov(mov);
    setEditQty(Math.abs(mov.changeQty));
    setEditNote(mov.note || '');
    setEditDate(mov.date ? mov.date.slice(0, 16) : new Date().toISOString().slice(0, 16));
  };

  const handleSaveEdit = async () => {
    if (!editingMov) return;
    try {
      const newChangeQty = editingMov.changeQty < 0 ? -Math.abs(editQty) : Math.abs(editQty);
      await updateInventoryMovement(editingMov.id, {
        changeQty: newChangeQty,
        note: editNote,
        date: new Date(editDate).toISOString()
      });
      toast.success('تم تعديل عملية المخزن وتحديث الرصيد بنجاح');
      setEditingMov(null);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تعديل العملية');
    }
  };

  const handleDeleteMov = async (movId: string) => {
    if (!window.confirm('هل أنت متاكد من حذف هذه العملية؟ سيتم إلغاء أثرها على رصيد المخزن.')) return;
    try {
      await deleteInventoryMovement(movId);
      toast.success('تم حذف العملية وإلغاء أثرها من المخزن');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف العملية');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[88vh] my-auto border border-gray-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-4">
            {liveProduct.image ? (
              <img src={liveProduct.image} alt={liveProduct.name} className="w-14 h-14 rounded-2xl object-cover border border-gray-200 shadow-sm" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 font-bold">
                <Package className="w-7 h-7" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-gray-900">{liveProduct.name}</h2>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-black px-2.5 py-1 rounded-lg">
                  إدارة المخزن
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-1 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 font-mono">
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  SKU: {liveProduct.sku || 'N/A'}
                </span>
                <SourceChannelBadge 
                  order={{ sourceChannel: liveProduct.channelName || 'طلب يدوي / مباشر' }} 
                  size="xs" 
                  configuredSalesChannels={salesChannels} 
                />
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getCurrentStock(selectedVarId) < 0 ? (
              <div className="flex items-center gap-2">
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-2.5 text-center min-w-[110px]">
                  <span className="text-[10px] font-bold text-rose-600 uppercase block mb-0.5">العجز الحالي</span>
                  <span className="text-lg font-black text-rose-700">{getCurrentStock(selectedVarId)} قطعة</span>
                </div>
                <button
                  onClick={async () => {
                    const currentStock = getCurrentStock(selectedVarId);
                    const deficit = Math.abs(currentStock);
                    try {
                      await recordStockAdjustment({
                        productId: liveProduct.id,
                        variationId: hasVariations && selectedVarId !== 'all' ? selectedVarId : (targetVarId || null),
                        changeQty: deficit,
                        typeName: 'تصفير العجز',
                        note: 'تسوية تلقائية لتصفير العجز وإرجاع الرصيد إلى 0'
                      });
                      toast.success('تم تصفير العجز وإرجاع الرصيد إلى 0 بنجاح');
                    } catch (err) {
                      console.error(err);
                      toast.error('حدث خطأ أثناء تصفير العجز');
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-3 py-2.5 rounded-2xl shadow-sm flex items-center gap-1.5 transition-all"
                  title="تصفير العجز لكي لا يخصم بأرقام خاطئة"
                >
                  <RotateCcw className="w-4 h-4" />
                  تصفير العجز
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center min-w-[120px]">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-0.5">المتوفر حالياً</span>
                <span className="text-xl font-black text-emerald-700">{getCurrentStock(selectedVarId)} قطعة</span>
              </div>
            )}
            <button 
              onClick={onClose}
              className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Variations Selector Tabs */}
        {hasVariations && (
          <div className="bg-gray-50/80 border-b border-gray-100 px-6 py-2.5 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
            <span className="text-xs font-bold text-gray-500 shrink-0 ml-2">تصفية حسب النوع/التفرع:</span>
            <button
              onClick={() => { setSelectedVarId('all'); setTargetVarId(liveProduct.variations[0]?.id || ''); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                selectedVarId === 'all' 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              جميع التفرعات ({getCurrentStock('all')})
            </button>
            {liveProduct.variations.map((v: any, idx: number) => {
              const vStock = Number(v.local_stock_quantity ?? v.stock_quantity ?? 0);
              const vName = v.name || v.attributes?.map((a: any) => a.option).join(' ') || `تفرع ${idx + 1}`;
              const vSku = v.sku || v.local_sku || (liveProduct.sku ? `${liveProduct.sku}-${idx + 1}` : '');
              const isSel = selectedVarId === v.id;
              return (
                <button
                  key={v.id || idx}
                  onClick={() => { setSelectedVarId(v.id); setTargetVarId(v.id); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                    isSel 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="whitespace-nowrap">{vName}</span>
                  {vSku && <span className="font-mono text-[10px] opacity-75 shrink-0">[{vSku}]</span>}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${isSel ? 'bg-white/20 text-white' : 'bg-gray-100 text-indigo-600'}`}>
                    {vStock}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
          
          {/* Create New Operation Form */}
          <div className="bg-white rounded-2xl p-5 border border-indigo-100/80 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-50 pb-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              تسجيل عملية مخزن جديدة (إدخال / تعديل / سحب)
            </h3>

            <form onSubmit={handleAddOperation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                
                {/* Variation selector if applicable */}
                {hasVariations && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">المنتج / التفرع المستهدف:</label>
                    <select
                      value={targetVarId}
                      onChange={(e) => setTargetVarId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {liveProduct.variations.map((v: any, idx: number) => {
                        const vSku = v.sku || v.local_sku || (liveProduct.sku ? `${liveProduct.sku}-${idx + 1}` : '');
                        return (
                          <option key={v.id || idx} value={v.id}>
                            {v.name || v.attributes?.map((a: any) => a.option).join(' ') || `تفرع ${idx + 1}`} {vSku ? `[${vSku}]` : ''} ({v.local_stock_quantity ?? v.stock_quantity ?? 0} حبة)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Operation Type */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">نوع العملية:</label>
                  <select
                    value={opType}
                    onChange={(e: any) => setOpType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="addition">➕ إدخال للمخزن (إضافة كمية)</option>
                    <option value="reduction">➖ إخراج من المخزن (سحب/عجز)</option>
                    <option value="adjustment">🎯 تسوية مخزنية (ضبط الرصيد النهائي)</option>
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    {opType === 'adjustment' ? 'الكمية الإجمالية الجديدة:' : 'الكمية (عدد القطع):'}
                  </label>
                  <input 
                    type="number"
                    min="0"
                    value={opQty}
                    onChange={(e) => setOpQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="مثال: 10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => { setOpType('adjustment'); setOpQty(0); setOpNote('تصفير رصيد المخزن (إعادة حساب من الصفر)'); }}
                    className="mt-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    تصفير رصيد المخزن (إعادة حساب من الصفر)
                  </button>
                </div>

                {/* Operation Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">تاريخ ووقت العملية:</label>
                  <input 
                    type="datetime-local"
                    value={opDate}
                    onChange={(e) => setOpDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Shipped Orders Info Banner & Toggle */}
              {shippedQty > 0 && (
                <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 mt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-amber-600" />
                      الطلبيات في حالة (تم الشحن): {shippedQty} قطعة
                    </span>
                    {opType === 'adjustment' && (
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={deductShipping}
                          onChange={(e) => setDeductShipping(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-amber-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    )}
                  </div>
                  {opType === 'adjustment' ? (
                    <p className="text-[11px] font-bold text-amber-800">
                      {deductShipping
                        ? `عند التسوية لـ ${opQty} قطعة بالخزينة ووجود ${shippedQty} قطعة بالشحن، سيكون الرصيد الفعلي = ${opQty - shippedQty} ${(opQty - shippedQty) < 0 ? '(عجز)' : 'قطعة'}.`
                        : `سيتم اعتماد الكمية ${opQty} مباشرة كرصيد متوفر بالمستودع دون خصم الطلبيات التي في حالة (تم الشحن).`}
                    </p>
                  ) : (
                    <p className="text-[11px] font-medium text-amber-800">
                      ملاحظة: يوجد {shippedQty} قطعة في حالة (تم الشحن) حالياً لهذا المنتج/التفرع.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <div className="flex-1 w-full">
                  <input 
                    type="text"
                    value={opNote}
                    onChange={(e) => setOpNote(e.target.value)}
                    placeholder="أدخل ملاحظة العملية (مثال: إدخال مخزني جديد، وصول شحنة، جرد دوري...)"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  تسجيل حركة المخزن
                </button>
              </div>
            </form>
          </div>

          {/* Operations History Log Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-gray-900">سجل حركات وعمليات المخزن المسجلة ({productMovements.length})</h3>
              </div>
              <span className="text-[11px] text-gray-400 font-bold">مسجلة بالتاريخ والملاحظات</span>
            </div>

            {productMovements.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                  <Clock className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-gray-500">لا توجد عمليات مخزن مسجلة لهذا المنتج حتى الآن.</p>
                <p className="text-[11px] text-gray-400 mt-1">قم بإضافة أول عملية إدخال أو تعديل باستخدام النموذج أعلاه.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-gray-50/70 text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100">
                      <th className="px-4 py-3">التاريخ والوقت</th>
                      <th className="px-4 py-3">النوع/التفرع</th>
                      <th className="px-4 py-3">نوع العملية</th>
                      <th className="px-4 py-3 text-center">التغيير (حبة)</th>
                      <th className="px-4 py-3 text-center">الرصيد بعد الحركة</th>
                      <th className="px-4 py-3">ملاحظة</th>
                      <th className="px-4 py-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                    {productMovements.map((mov: any, idx: number) => {
                      const isAdd = mov.changeQty > 0;
                      const formattedDate = mov.date ? format(parseISO(mov.date), 'yyyy/MM/dd - HH:mm', { locale: ar }) : 'غير معروف';

                      return (
                        <tr key={`${mov.id}_${idx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-600 dir-ltr text-right">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {formattedDate}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {mov.variationName || liveProduct.name}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${
                              isAdd ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {isAdd ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                              {mov.typeName || (isAdd ? 'إدخال مخزن' : 'سحب مخزن')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-black text-sm">
                            <span className={isAdd ? 'text-emerald-600' : 'text-rose-600'}>
                              {isAdd ? `+${mov.changeQty}` : mov.changeQty}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="bg-slate-100 text-slate-800 font-black px-2 py-1 rounded-md text-xs">
                              {mov.newStock} حبة
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={mov.note || ''}>
                            {mov.note || '--'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleStartEdit(mov)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="تعديل العملية"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingMov(mov)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="حذف العملية وإلغاء أثرها"
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
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-all shadow-sm"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* Edit Movement Modal */}
      {editingMov && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-gray-100 space-y-4 max-h-[85vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                تعديل حركة المخزن
              </h3>
              <button onClick={() => setEditingMov(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">الكمية المطلوبة (عدد القطع):</label>
              <input 
                type="number"
                min="0"
                value={editQty}
                onChange={(e) => setEditQty(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">تاريخ العملية:</label>
              <input 
                type="datetime-local"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">الملاحظة:</label>
              <input 
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="ملاحظات..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all"
              >
                حفظ التعديلات
              </button>
              <button
                onClick={() => setEditingMov(null)}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-2.5 rounded-xl transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Movement Confirmation Modal */}
      {deletingMov && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-base">تأكيد حذف عملية المخزن</h3>
                <p className="text-xs text-gray-500 font-bold mt-0.5">عملية غير قابلة للتراجع</p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 text-xs font-bold text-rose-900 space-y-2 leading-relaxed">
              <p>هل أنت متأكد من حذف هذه العملية؟</p>
              <div className="bg-white/90 p-3 rounded-xl border border-rose-100 text-gray-800 font-normal space-y-1 text-xs">
                <div><strong>النوع/التفرع:</strong> {deletingMov.variationName || liveProduct.name}</div>
                <div><strong>نوع العملية:</strong> {deletingMov.typeName}</div>
                <div><strong>مقدار التغيير:</strong> {deletingMov.changeQty > 0 ? `+${deletingMov.changeQty}` : deletingMov.changeQty} قطعة</div>
                {deletingMov.note && <div><strong>ملاحظة:</strong> {deletingMov.note}</div>}
              </div>
              <p className="text-[11px] text-rose-700 font-bold">ملاحظة: سيتم إلغاء أثر هذه العملية وتحديث الرصيد بالمستودع تلقائياً.</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                disabled={isDeletingMov}
                onClick={async () => {
                  setIsDeletingMov(true);
                  try {
                    await deleteInventoryMovement(deletingMov.id);
                    toast.success('تم حذف العملية وإلغاء أثرها من المخزن بنجاح');
                    setDeletingMov(null);
                  } catch (e) {
                    toast.error('حدث خطأ أثناء حذف العملية');
                  } finally {
                    setIsDeletingMov(false);
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingMov ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                تأكيد الحذف
              </button>
              <button
                disabled={isDeletingMov}
                onClick={() => setDeletingMov(null)}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition-all"
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
