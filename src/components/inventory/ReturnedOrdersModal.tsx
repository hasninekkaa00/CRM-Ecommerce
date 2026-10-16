import React, { useMemo, useState } from 'react';
import { X, Undo2, MapPin, Phone, User, Calendar, Package, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useStore } from '../../store';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

interface ReturnedOrdersModalProps {
  product: any;
  onClose: () => void;
}

export function ReturnedOrdersModal({ product, onClose }: ReturnedOrdersModalProps) {
  const { orders, updateOrder, recordStockAdjustment } = useStore();
  const [activeTab, setActiveTab] = useState<'current' | 'restocked'>('current');

  const { current: currentReturned, restocked: restockedReturned } = useMemo(() => {
    const current: any[] = [];
    const restocked: any[] = [];
    
    if (!product || !orders) return { current, restocked };
    
    orders.forEach(o => {
      const s1 = (o.status1 || '').trim().toLowerCase();
      const s2 = (o.status2 || '').trim().toLowerCase();
      const isReturned = s2 === 'مرتجع' || s1 === 'مرتجع';
      
      if (!isReturned) return;

      const matchCheck = (n: string, v: string, s: string) => {
          const oSku = (s || '').trim().toLowerCase();
          if (!oSku) return false;

          if (product.sku && oSku.split(',').map((x:string)=>x.trim()).includes(product.sku.toLowerCase().trim())) return true;
          
          let found = false;
          if (product.variations) {
             product.variations.forEach((vObj:any) => {
                if (vObj.sku && oSku.split(',').map((x:string)=>x.trim()).includes(vObj.sku.toLowerCase().trim())) found = true;
             });
          }
          return found;
      };

      let matched = false;
      if (matchCheck(o.productName, o.variation, o.sku)) {
          matched = true;
      }
      if (o.items && Array.isArray(o.items)) {
          o.items.forEach((it:any) => {
             if (matchCheck(it.name, it.variation, it.sku)) matched = true;
          });
      }
      
      if (matched) {
          if (o.stockRestocked) {
              restocked.push(o);
          } else {
              current.push(o);
          }
      }
    });
    
    return { current, restocked };
  }, [product, orders]);

  const handleRestockOrder = async (order: any) => {
    try {
      const getSafeQty = (qval: any) => {
        if (!qval) return 1;
        const digits = String(qval).match(/\d+/);
        const parsed = digits ? parseInt(digits[0], 10) : 1;
        return isNaN(parsed) ? 1 : parsed;
      };

      const orderQty = getSafeQty(order.qnts);

      // Match variation if applicable
      let matchedVarId: string | null = null;
      if (product.variations && Array.isArray(product.variations)) {
        const oSku = (order.sku || '').toLowerCase();
        const vMatch = product.variations.find((v: any) => {
          const vSku = (v.sku || '').toLowerCase();
          return vSku && oSku.split(',').map((x: string) => x.trim()).includes(vSku);
        });
        if (vMatch) matchedVarId = vMatch.id;
      }

      await recordStockAdjustment({
        productId: product.id,
        variationId: matchedVarId,
        changeQty: orderQty,
        typeName: 'إعادة إدخال للمخزن (مرتجع)',
        note: `إعادة إدخال طلبيّة مرتجعة للعميل: ${order.fullName || 'غير معروف'}`
      });

      await updateOrder(order.id, { stockRestocked: true });
      toast.success('تم إعادة إدخال المنتجات إلى المخزن بنجاح وتحديث رصيد المتاح');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء إعادة إدخال المرتجع إلى المخزن');
    }
  };

  const displayedOrders = activeTab === 'current' ? currentReturned : restockedReturned;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] sm:max-h-[88vh] my-auto overflow-hidden border border-slate-100" dir="rtl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
               <Undo2 className="w-5 h-5" />
             </div>
             <div>
               <h2 className="text-lg font-bold text-gray-900">الطلبيات المرتجعة العالقة (روتور)</h2>
               <p className="text-xs font-medium text-gray-500 mt-0.5">
                 {product?.name}
               </p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-100 px-6 pt-4">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('current')}
              className={`pb-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'current' 
                  ? 'border-rose-500 text-rose-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Undo2 className="w-4 h-4" />
              الروتور العالق ({currentReturned.length})
            </button>
            <button
              onClick={() => setActiveTab('restocked')}
              className={`pb-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'restocked' 
                  ? 'border-emerald-500 text-emerald-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              سجل تم إعادة إدخاله ({restockedReturned.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {displayedOrders.length === 0 ? (
             <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Package className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">لا توجد طلبيات مرتجعة</h3>
                <p className="text-sm text-slate-500">
                    {activeTab === 'current' ? 'هذا المنتج ليس لديه أي طلبيات مرتجعة عالقة حالياً.' : 'سجل المرتجعات التي أعيد إدخالها للمخزن فارغ.'}
                </p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedOrders.map(order => {
                   const getReturnDate = (ord: any) => {
                       let matchedDate = null;
                       if (ord.activity && Array.isArray(ord.activity)) {
                          const act = [...ord.activity].reverse().find(a => a.status === 'Return_received' || a.status === 'return_received' || a.status === 'return_asks' || a.status === 'return_in_transit');
                          if (act && act.date) matchedDate = parseISO(act.date);
                       }
                       if (!matchedDate && ord.trackingHistory && Array.isArray(ord.trackingHistory)) {
                          const hist = [...ord.trackingHistory].reverse().find(a => a.status?.includes('مرتجع') || a.status?.includes('تم الإسترجاع'));
                          if (hist && hist.date) matchedDate = parseISO(hist.date);
                       }
                       if (!matchedDate && ord.manualActivity && Array.isArray(ord.manualActivity)) {
                           const mAct = ord.manualActivity.find((a:any) => a.status === 'مرتجع');
                           if (mAct && mAct.date) matchedDate = parseISO(mAct.date);
                       }
                       if (!matchedDate && ord.orderDate) {
                           matchedDate = parseISO(ord.orderDate);
                       }
                       return matchedDate;
                   };
                   
                   const rDate = getReturnDate(order);

                   return (
                     <div key={order.id} className="bg-white rounded-2xl p-4 border border-rose-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                        <div className="absolute top-0 right-0 left-0 h-1 bg-rose-400"></div>
                        
                        <div>
                          <div className="flex justify-between items-start mb-3">
                             <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 mb-1.5">
                                   <Calendar className="w-3.5 h-3.5" />
                                   تاريخ الطلب: {order.orderDate ? format(parseISO(order.orderDate), 'yyyy/MM/dd') : 'غير متوفر'}
                                </div>
                                <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-2 mb-2 flex items-center gap-1.5">
                                  <User className="w-4 h-4 text-rose-500" />
                                  {order.fullName || 'عميل غير معروف'}
                                </h4>
                             </div>
                             <div className="bg-rose-50 border border-rose-100 px-2 py-1 rounded-lg text-xs font-black text-rose-700">
                                {order.qnts || 1} قطع
                             </div>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600 font-medium">
                             <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-indigo-500 shrink-0" />
                                <span className="line-clamp-2">
                                  {(() => {
                                     const products = [];
                                     if (order.productName) products.push(`${order.productName} ${order.variation ? `- ${order.variation}` : ''}`);
                                     if (order.items && Array.isArray(order.items)) {
                                        order.items.forEach((it:any) => products.push(`${it.name} ${it.variation ? `- ${it.variation}` : ''}`));
                                     }
                                     return Array.from(new Set(products)).join('، ') || 'منتج غير معروف';
                                  })()}
                                </span>
                             </div>
                             <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span dir="ltr">{order.phone}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="line-clamp-1">{order.state} {order.commune ? `- ${order.commune}` : ''}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <Undo2 className="w-4 h-4 text-purple-500 shrink-0" />
                                <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-xs font-bold">تاريخ الإرجاع: {rDate ? format(rDate, 'yyyy/MM/dd') : 'غير معروف'}</span>
                             </div>
                          </div>
                        </div>

                        {activeTab === 'current' && (
                          <button
                            onClick={() => handleRestockOrder(order)}
                            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex justify-center items-center gap-2 transition-all shadow-sm"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                            إعادة إدخال للمخزن (إضافة للمتوفر)
                          </button>
                        )}
                     </div>
                   );
                })}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
