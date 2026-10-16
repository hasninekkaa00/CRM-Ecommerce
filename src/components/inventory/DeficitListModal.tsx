import React, { useMemo, useState } from 'react';
import { X, AlertTriangle, Box, Minus, ShoppingCart, Printer, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store';
import { calculateDynamicStock } from '../../utils/inventoryCalc';
import toast from 'react-hot-toast';

interface DeficitListModalProps {
  onClose: () => void;
}

export function DeficitListModal({ onClose }: DeficitListModalProps) {
  const { inventoryProducts, settings, purchaseInvoices, orders, recordStockAdjustment } = useStore();
  const products = inventoryProducts || [];

  const [confirmZeroAll, setConfirmZeroAll] = useState(false);
  const [confirmZeroItem, setConfirmZeroItem] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const detailedDeficitList = useMemo(() => {
      const isLocal = settings?.inventoryManagementMode === 'local';
      const list: any[] = [];
      products.forEach(p => {
          let hasVariations = p.variations && p.variations.length > 0;
          
          const isOfferFallback = hasVariations && p.variations.some((v:any) =>
              v.attributes?.some((a:any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))
          );
          const isOffer = p.local_is_offers !== undefined ? p.local_is_offers : isOfferFallback;

          if (hasVariations && !isOffer) {
              p.variations.forEach((v: any) => {
                  const vManage = isLocal ? true : v.manage_stock;
                  if (vManage) {
                      const vQty = isLocal ? calculateDynamicStock(v, false, p, purchaseInvoices, orders) : Number(v.stock_quantity ?? v.quantity ?? 0);
                      if (vQty < 0) {
                          list.push({
                              id: v.id || `${p.id}-${v.name}`,
                              parent: p,
                              variation: v,
                              name: `${p.name} - ${v.name || v.attributes?.map((a:any) => a.option).join(' ')}`,
                              sku: v.sku || p.sku,
                              image: v.image?.src || p.images?.[0]?.src,
                              deficitAmount: Math.abs(vQty)
                          });
                      }
                  }
              });
          }
          
          if (!hasVariations || isOffer || (isLocal && !hasVariations)) {
              const pManage = isLocal ? true : p.manage_stock;
              if (pManage) {
                  const pQty = isLocal ? calculateDynamicStock(p, true, p, purchaseInvoices, orders) : Number(p.stock_quantity ?? p.quantity ?? 0);
                  if (pQty < 0) {
                      list.push({
                          id: p.id,
                          parent: p,
                          variation: null,
                          name: p.name,
                          sku: p.sku,
                          image: p.images?.[0]?.src,
                          deficitAmount: Math.abs(pQty)
                      });
                  }
              }
          }
      });
      return list.sort((a, b) => b.deficitAmount - a.deficitAmount);
  }, [products, settings?.inventoryManagementMode, purchaseInvoices, orders]);

  const handlePrint = () => {
    window.print();
  };

  const handleZeroItem = async (item: any) => {
    setIsProcessing(true);
    try {
      await recordStockAdjustment({
        productId: item.parent.id,
        variationId: item.variation?.id || null,
        changeQty: item.deficitAmount,
        typeName: 'تصفير العجز',
        note: `تسوية تلقائية لتصفير العجز (${item.name})`
      });
      toast.success(`تم تصفير عجز ${item.name} وإرجاع الرصيد إلى 0 بنجاح`);
      setConfirmZeroItem(null);
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تصفير العجز');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleZeroAll = async () => {
    if (detailedDeficitList.length === 0) return;
    setIsProcessing(true);
    try {
      for (const item of detailedDeficitList) {
        await recordStockAdjustment({
          productId: item.parent.id,
          variationId: item.variation?.id || null,
          changeQty: item.deficitAmount,
          typeName: 'تصفير العجز الجماعي',
          note: `تسوية تلقائية لتصفير العجز الجماعي (${item.name})`
        });
      }
      toast.success(`تم تصفير العجز لكافة المنتجات (${detailedDeficitList.length} عنصر) بنجاح`);
      setConfirmZeroAll(false);
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تصفير جميع العجز');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl max-h-[85vh] sm:max-h-[88vh] my-auto flex flex-col rounded-3xl shadow-2xl overflow-hidden" dir="rtl">
        <div className="flex justify-between items-center bg-rose-50 px-6 py-5 border-b border-rose-100 shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm border border-rose-200">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-rose-900">قائمة المشتريات وتصفير العجز</h2>
              <p className="text-sm font-bold text-rose-600 mt-1">
                الكميات المطلوبة لتغطية الطلبيات الحالية مع إمكانية تصفير العجز بضغطة زر
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {detailedDeficitList.length > 0 && (
               <button 
                  onClick={() => setConfirmZeroAll(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm"
               >
                  <RotateCcw className="w-4 h-4" /> تصفير كل العجز
               </button>
             )}
             <button 
                onClick={handlePrint}
                className="bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
             >
                <Printer className="w-4 h-4" /> طباعة القائمة
             </button>
             <button onClick={onClose} className="bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 p-2.5 rounded-xl transition-all shadow-sm">
               <X className="w-5 h-5" />
             </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 printable-area bg-slate-50 space-y-4">
           <style dangerouslySetInnerHTML={{__html: `
              @media print {
                 body * { visibility: hidden; }
                 .printable-area, .printable-area * { visibility: visible; }
                 .printable-area { position: absolute; left: 0; top: 0; right: 0; width: 100%; height: auto; padding: 20px !important; background: white !important; margin: 0; }
                 .print\\:hidden { display: none !important; }
                 @page { margin: 1cm; }
              }
           `}} />
           
           <div className="print:hidden flex items-center justify-between gap-2 bg-rose-100/80 text-rose-900 px-4 py-3 rounded-2xl border border-rose-200 font-bold text-xs">
               <div className="flex items-center gap-2">
                 <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" /> 
                 <span>تظهر هذه القائمة المنتجات ذات الرصيد الأقل من الصفر. يمكنك تصفير العجز لإرجاع رصيدها إلى صفر بدلاً من الخصم بالسالب.</span>
               </div>
           </div>

           {detailedDeficitList.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center shadow-sm">
                 <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-4 border border-emerald-100">
                    <CheckCircle2 className="w-10 h-10" />
                 </div>
                 <h3 className="text-lg font-black text-slate-800 mb-2">ممتاز! لا يوجد أي عجز في المخزون</h3>
                 <p className="text-slate-500 font-bold text-xs max-w-sm">
                    المخزون الحالي متوازن ومستقر. جميع المنتجات رصيدها أكبر من أو يساوي الصفر.
                 </p>
              </div>
           ) : (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                 <table className="w-full text-right">
                    <thead className="bg-slate-50 border-b border-slate-200">
                       <tr>
                          <th className="px-6 py-4 text-slate-600 font-black text-xs w-16">الصورة</th>
                          <th className="px-6 py-4 text-slate-600 font-black text-xs">المنتج / النوع</th>
                          <th className="px-6 py-4 text-slate-600 font-black text-xs text-center">رمز SKU</th>
                          <th className="px-6 py-4 text-slate-600 font-black text-xs text-center">الكمية الناقصة (العجز)</th>
                          <th className="px-6 py-4 text-slate-600 font-black text-xs text-center print:hidden">إجراء تصفير العجز</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                       {detailedDeficitList.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                             <td className="px-6 py-3">
                                {item.image ? (
                                   <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm bg-white" />
                                ) : (
                                   <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                                      <Box className="w-5 h-5" />
                                   </div>
                                )}
                             </td>
                             <td className="px-6 py-4">
                                <div className="font-black text-slate-800">{item.name}</div>
                             </td>
                             <td className="px-6 py-4 text-center">
                                {item.sku ? (
                                   <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">{item.sku}</span>
                                ) : (
                                   <span className="text-slate-300">-</span>
                                )}
                             </td>
                             <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-black">
                                   -{item.deficitAmount} قطعة
                                </span>
                             </td>
                             <td className="px-6 py-4 text-center print:hidden">
                                <button
                                  onClick={() => setConfirmZeroItem(item)}
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1 mx-auto"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                                  تصفير العجز
                                </button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           )}
        </div>
      </div>

      {/* Confirmation Modal: Single Item Zeroing */}
      {confirmZeroItem && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4" dir="rtl">
            <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-3 rounded-2xl border border-amber-100">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-black text-amber-900 text-sm">تأكيد تصفير عجز هذا المنتج</h3>
            </div>
            <p className="text-xs font-bold text-slate-600 leading-relaxed">
              هل أنت متأكد من تصفير عجز <span className="text-indigo-600 font-black">{confirmZeroItem.name}</span>؟ 
              سيتم إضافة حركة تسوية لتغطية ({confirmZeroItem.deficitAmount} قطعة) وإعادة رصيد هذا المنتج/التفرع إلى <span className="font-black text-slate-900">0</span>.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handleZeroItem(confirmZeroItem)}
                disabled={isProcessing}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50"
              >
                {isProcessing ? 'جاري التصفير...' : 'نعم، صفر العجز'}
              </button>
              <button
                onClick={() => setConfirmZeroItem(null)}
                disabled={isProcessing}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Zeroing All Deficits */}
      {confirmZeroAll && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4" dir="rtl">
            <div className="flex items-center gap-3 text-rose-600 bg-rose-50 p-3 rounded-2xl border border-rose-100">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <h3 className="font-black text-rose-900 text-sm">تأكيد تصفير العجز لجميع المنتجات</h3>
            </div>
            <p className="text-xs font-bold text-slate-600 leading-relaxed">
              سيتم تصفير العجز لجميع العناصر البالغ عددها <span className="text-rose-600 font-black">{detailedDeficitList.length} عنصر</span> وإعادة أرصدتها السالبة إلى <span className="font-black text-slate-900">0</span>.
              هل تريد الاستمرار؟
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleZeroAll}
                disabled={isProcessing}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50"
              >
                {isProcessing ? 'جاري تصفير الكل...' : 'نعم، صفر جميع العجز'}
              </button>
              <button
                onClick={() => setConfirmZeroAll(false)}
                disabled={isProcessing}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
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

