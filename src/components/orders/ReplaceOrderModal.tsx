import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { X, RefreshCw, Search, CheckCircle, Plus, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { Order } from '../../types';
import { WILAYAS_MAP } from '../../utils/algeriaWilayas';
import ecotrackCommunes from '../../ecotrack-communes.json';
import { ShippingDeskInfo } from '../shipping/ShippingDeskInfo';

const ALGERIA_WILAYAS = Object.entries(WILAYAS_MAP).map(([code, name]) => ({
  code,
  id: parseInt(code, 10),
  name,
})).sort((a, b) => a.id - b.id);

const getWilayaCode = (regionStr: string | undefined | null): string => {
  if (!regionStr) return "";
  const trimmed = regionStr.trim();
  const m = trimmed.match(/\d{1,2}/);
  if (m && parseInt(m[0], 10) > 0 && parseInt(m[0], 10) <= 58) {
    const codeVal = parseInt(m[0], 10);
    return codeVal < 10 ? `0${codeVal}` : `${codeVal}`;
  }
  // Try fallback to name-based match
  const cleanLower = trimmed.toLowerCase();
  for (const [code, arabicLabel] of Object.entries(WILAYAS_MAP)) {
    const withoutNumber = arabicLabel.split(" - ")[1] || "";
    const englishName = withoutNumber.includes("(") ? withoutNumber.split("(")[1]?.replace(")", "")?.trim() : "";
    const arabicName = withoutNumber.split(" (")[0]?.trim();
    if (
      cleanLower === code ||
      cleanLower === englishName?.toLowerCase() ||
      trimmed === arabicName ||
      cleanLower.includes(englishName?.toLowerCase() || "___") ||
      trimmed.includes(arabicName || "___")
    ) {
      return code;
    }
  }
  return "";
};

interface ReplaceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalOrder: Order | null;
}

export function ReplaceOrderModal({ isOpen, onClose, originalOrder }: ReplaceOrderModalProps) {
  const { orders, updateOrder, addOrder, inventoryProducts } = useStore();
  
  // 'null' = Pick mode, 'create' = Create new order, 'link' = Link existing order
  const [mode, setMode] = useState<'create' | 'link' | null>(null);

  // Link Mode State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Create Mode State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    region: '',
    city: '',
    stopdeskCommune: '',
    productName: '',
    variation: '',
    sku: '',
    qnts: '1',
    priceWithoutDelivery: '0',
    deliveryPrice: '0',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset and prefill when modal opens
  useEffect(() => {
    if (originalOrder && isOpen) {
      setMode(null);
      setSearchTerm(originalOrder.phone || '');
      setSelectedOrderId(null);

      setFormData({
        fullName: originalOrder.fullName || '',
        phone: originalOrder.phone || '',
        region: originalOrder.region || '',
        city: originalOrder.city || '',
        stopdeskCommune: originalOrder.stopdeskCommune || '',
        productName: originalOrder.productName || '',
        variation: originalOrder.variation || '',
        sku: originalOrder.sku || '',
        qnts: '1',
        priceWithoutDelivery: '0',
        deliveryPrice: originalOrder.deliveryPrice?.toString() || '0',
        notes: 'بديلة للطلبية: ' + (originalOrder.orderId || ''),
      });
    }
  }, [originalOrder, isOpen]);

  // Find suitable replacement candidates: shipped or confirmed orders with no replacedOrderId
  const candidates = useMemo(() => {
    if (!originalOrder) return [];
    return orders.filter(o => 
      o.id !== originalOrder.id && 
      !o.replacedOrderId && // Not already a replacement for something else
      !o.replacementOrderId && // Not already replaced by something else
      (o.status1 === 'مؤكد' || ['تم الشحن', 'في الطريق', 'مستلم'].includes(o.status2 || '')) &&
      (!searchTerm || 
        o.orderId?.includes(searchTerm) || 
        o.shippingTrackingId?.includes(searchTerm) || 
        o.fullName?.includes(searchTerm) || 
        o.phone?.includes(searchTerm))
    ).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [orders, originalOrder, searchTerm]);

  if (!isOpen || !originalOrder) return null;

  const handleLinkSubmit = async () => {
    if (!selectedOrderId) {
      toast.error('الرجاء تحديد الطلبية البديلة');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateOrder(originalOrder.id, {
        replacementOrderId: selectedOrderId,
        isExchangedReturn: true
      });

      await updateOrder(selectedOrderId, {
        replacedOrderId: originalOrder.id,
        isReplacement: true
      });

      toast.success('تم ربط الطلبية البديلة بنجاح!');
      onClose();
    } catch (error: any) {
      toast.error('حدث خطأ أثناء الربط');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const qnts = Number(formData.qnts) || 1;
      const unitPrice = Number(formData.priceWithoutDelivery) || 0;
      const newProductTotal = unitPrice * qnts;
      const oldProductTotal = originalOrder?.priceWithoutDelivery || 0; // priceWithoutDelivery in db is already total
      const priceDifference = newProductTotal - oldProductTotal;
      const delivery = Number(formData.deliveryPrice) || 0;
      
      const amountToCollect = Math.max(0, priceDifference + delivery);

      const newOrder: Order = {
        id: uuidv4(),
        orderId: 'REP-' + (originalOrder.orderId || Math.floor(Math.random() * 1000000).toString()) + '-' + Math.floor(Math.random() * 100),
        orderDate: new Date().toISOString(),
        fullName: formData.fullName,
        phone: formData.phone,
        region: formData.region,
        city: formData.city,
        stopdeskCommune: formData.stopdeskCommune,
        productName: formData.productName,
        variation: formData.variation,
        sku: formData.sku,
        qnts: qnts,
        priceWithoutDelivery: newProductTotal, // We record the ACTUAL new product value
        deliveryPrice: delivery,
        totalCharge: amountToCollect, // This is what the shipping company collects
        status1: 'جديد',
        status2: '',
        shippingMethod: originalOrder.shippingMethod,
        deliveryCompany: '',
        confirmedBy: '',
        ip: '',
        postponementDate: '',
        shippingTrackingId: null,
        notes: formData.notes + ` | مبلغ التحصيل: فارق السعر (${priceDifference}) + التوصيل (${delivery})`,
        isReplacement: true,
        replacedOrderId: originalOrder.orderId, // Link automatically so user doesn't have to link it manually later!
        archived: false,
        trashed: false,
        stockDeducted: false,
        stockRestocked: false,
        stockReshipped: false
      };

      await addOrder(newOrder);

      // Auto-update the original order to point to this new one
      await updateOrder(originalOrder.id, {
        replacementOrderId: newOrder.id,
        isExchangedReturn: true
      });

      toast.success('تم إنشاء الطلبية البديلة وربطها بنجاح!');
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'حدث خطأ أثناء إضافة الطلبية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCreateForm = () => {
    const newProductTotal = Number(formData.priceWithoutDelivery) * Number(formData.qnts);
    const oldProductTotal = originalOrder.priceWithoutDelivery || 0;
    const priceDifference = newProductTotal - oldProductTotal;
    const amountToCollect = Math.max(0, priceDifference + Number(formData.deliveryPrice));
    
    return (
      <form onSubmit={handleCreateSubmit} className="p-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm mb-2">
          يتم إنشاء طلبية جديدة وربطها تلقائياً بهذه الطلبية. أدخل بيانات المنتج البديل.
        </div>
        
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="block text-xs font-bold text-gray-700 mb-1">اسم الزبون</label>
             <input
               type="text" required value={formData.fullName ?? ''}
               onChange={e => setFormData({ ...formData, fullName: e.target.value })}
               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
             />
           </div>
           <div>
             <label className="block text-xs font-bold text-gray-700 mb-1">الهاتف</label>
             <input
               type="text" required dir="ltr" value={formData.phone ?? ''}
               onChange={e => setFormData({ ...formData, phone: e.target.value })}
               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-right"
             />
           </div>
           <div>
             <label className="block text-xs font-bold text-gray-700 mb-1">الولاية</label>
             <select
               value={getWilayaCode(formData.region)}
               onChange={(e) => {
                 const val = e.target.value;
                 if (val) {
                   const label = WILAYAS_MAP[val];
                   setFormData({ ...formData, region: label, city: '' });
                 } else {
                   setFormData({ ...formData, region: '', city: '' });
                 }
               }}
               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-bold"
             >
               <option value="">اختر الولاية...</option>
               {ALGERIA_WILAYAS.map((w) => (
                 <option key={w.code} value={w.code}>
                   {w.name}
                 </option>
               ))}
             </select>
           </div>
           <div>
             <label className="block text-xs font-bold text-gray-700 mb-1">المدينة</label>
             {(() => {
               const wilayaCode = getWilayaCode(formData.region);
               const wilayaId = wilayaCode ? parseInt(wilayaCode, 10) : null;
               const communes = wilayaId 
                 ? (ecotrackCommunes as any[]).filter((c: any) => c.wilaya_id === wilayaId) 
                 : [];

               if (communes.length > 0) {
                 return (
                   <select
                     value={formData.city || ''}
                     onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-bold"
                   >
                     <option value="">اختر البلدية...</option>
                     {communes.map((c, idx) => (
                       <option key={`replace-commune-${idx}`} value={c.nom}>
                         {c.nom} {c.has_stop_desk === 1 ? '🏪 (مكتب)' : ''}
                       </option>
                     ))}
                   </select>
                 );
               } else {
                 return (
                   <input
                     type="text" required value={formData.city ?? ''}
                     onChange={e => setFormData({ ...formData, city: e.target.value })}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                     placeholder="البلدية/المدينة"
                   />
                 );
               }
             })()}
           </div>
        </div>

        {/* Product Picker */}
        <div>
          <label className="block text-xs font-bold text-indigo-700 mb-1">اختر من المخزن (لتعبئة التفاصيل تلقائياً)</label>
          <select 
             className="w-full border border-indigo-200 bg-indigo-50/50 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
             value={formData.sku ? JSON.stringify({ sku: formData.sku, name: formData.productName, variation: formData.variation || '', price: Number(formData.priceWithoutDelivery) || 0 }) : ''}
             onChange={(e) => {
                if (!e.target.value) return;
                try {
                   const parsed = JSON.parse(e.target.value);
                   const updates: any = { sku: parsed.sku, productName: parsed.name, variation: parsed.variation };
                   if (parsed.price !== undefined && parsed.price >= 0) {
                      updates.priceWithoutDelivery = parsed.price.toString();
                   }
                   setFormData({ ...formData, ...updates });
                } catch (err) {}
             }}
          >
             <option value="">-- اختر من المخزن --</option>
             {inventoryProducts?.map(p => {
                const hasVariations = p.variations && p.variations.length > 0;
                if (hasVariations) {
                   return (
                      <optgroup key={p.id} label={p.name}>
                         {p.variations.map((v: any, vIdx: number) => {
                            const varName = v.attributes?.map((a:any) => a.option).join(' - ') || `تفرع ${vIdx+1}`;
                            const varPrice = v.price || p.price || p.regular_price || 0;
                            const vSku = v.sku || v.local_sku || (p.sku ? `${p.sku}-${vIdx + 1}` : ''); const val = JSON.stringify({ sku: vSku, name: p.name, variation: varName, price: varPrice });
                            return (
                               <option key={`${p.id}-${vIdx}`} value={val}>
                                  {varName} {vSku ? `[${vSku}]` : ''} - {varPrice} د.ج
                               </option>
                            )
                         })}
                      </optgroup>
                   );
                } else {
                   const basePrice = p.price || p.regular_price || 0;
                   const val = JSON.stringify({ sku: p.sku || '', name: p.name, variation: '', price: basePrice });
                   return (
                      <option key={p.id} value={val}>
                         {p.name} {p.sku ? `[${p.sku}]` : ''} - {basePrice} د.ج
                      </option>
                   );
                }
             })}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">المنتج البديل *</label>
            <input
              type="text" required value={formData.productName ?? ''}
              onChange={e => setFormData({ ...formData, productName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">النوع / اللون (اختياري)</label>
            <input
              type="text" value={formData.variation ?? ''}
              onChange={e => setFormData({ ...formData, variation: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">الكمية</label>
            <input
              type="number" min="1" value={formData.qnts ?? '1'}
              onChange={e => setFormData({ ...formData, qnts: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">سعر المنتج الجديد</label>
            <input
              type="number" value={formData.priceWithoutDelivery ?? '0'}
              onChange={e => setFormData({ ...formData, priceWithoutDelivery: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">سعر التوصيل</label>
            <input
              type="number" value={formData.deliveryPrice ?? '0'}
              onChange={e => setFormData({ ...formData, deliveryPrice: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex flex-col gap-3">
           <div className="flex justify-between items-center text-sm">
              <span className="text-purple-700">سعر المنتج الجديد:</span>
              <span className="font-bold text-purple-900">{newProductTotal} د.ج</span>
           </div>
           <div className="flex justify-between items-center text-sm">
              <span className="text-purple-700">المدفوع مسبقاً (سعر المنتج الأصلي):</span>
              <span className="font-bold text-purple-900 text-opacity-70">- {oldProductTotal} د.ج</span>
           </div>
           <div className="flex justify-between items-center text-sm">
              <span className="text-purple-700">فارق السعر:</span>
              <span className={`font-bold ${priceDifference > 0 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">{priceDifference > 0 ? '+' : ''}{priceDifference} د.ج</span>
           </div>
           
           <div className="border-t border-purple-200 my-1"></div>
           
           <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-purple-800">المبلغ المطلوب تحصيله (الفارق + التوصيل):</span>
              <span className="font-black text-xl text-purple-900">{amountToCollect} د.ج</span>
           </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات</label>
          <textarea
            value={formData.notes ?? ''}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>
        
        <div className="pt-4 border-t border-gray-100 flex gap-3 mt-auto">
          <button type="button" onClick={() => setMode(null)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">
            تراجع
          </button>
          <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'إنشاء الطلبية'}
          </button>
        </div>
      </form>
    );
  };

  const renderLinkMode = () => (
    <div className="p-4 flex-1 flex flex-col gap-4 overflow-hidden">
      <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg text-sm shrink-0">
        أنت تقوم بربط طلبية موجودة كبديلة للطلبية المستلمة <strong>#{originalOrder.orderId}</strong>.<br/>
        عندما يتم توصيل الطلبية البديلة، ستتحول الطلبية الحالية تلقائياً إلى <strong>مرتجع</strong> لتسهيل إعادتها للمخزن.
      </div>

      <div className="relative shrink-0">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="ابحث برقم الهاتف، رقم التتبع، أو اسم الزبون..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-sm"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100 min-h-[200px]">
        {candidates.length > 0 ? candidates.map(order => (
          <label 
            key={order.id} 
            className={`flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-gray-50 ${selectedOrderId === order.id ? 'bg-purple-50/50' : ''}`}
          >
            <div className="mt-0.5">
              <input 
                type="radio" 
                name="replacementOrder" 
                value={order.id}
                checked={selectedOrderId === order.id}
                onChange={() => setSelectedOrderId(order.id)}
                className="w-4 h-4 text-purple-600 focus:ring-purple-500"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-gray-900 truncate">{order.fullName || 'بدون اسم'}</span>
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">#{order.orderId}</span>
              </div>
              <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                <span>📱 {order.phone}</span>
                {order.shippingTrackingId && <span>📦 {order.shippingTrackingId}</span>}
                <span className={`px-1.5 rounded-sm ${order.status2 ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100'}`}>{order.status2 || order.status1}</span>
              </div>
              <div className="text-xs text-gray-600 mt-1 truncate">
                🛒 {order.productName} {order.variation ? `(${order.variation})` : ''}
              </div>
            </div>
          </label>
        )) : (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
            <Search className="w-8 h-8 mb-2 opacity-20" />
            <p>لم يتم العثور على طلبيات مطابقة</p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-gray-100 flex gap-3 shrink-0">
        <button type="button" onClick={() => setMode(null)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">
          تراجع
        </button>
        <button type="button" onClick={handleLinkSubmit} disabled={!selectedOrderId || isSubmitting} className="flex-1 px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <> <CheckCircle className="w-4 h-4" /> تأكيد الربط </>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0 bg-purple-50/50">
          <div className="flex items-center gap-2 text-purple-700">
            <RefreshCw className="w-5 h-5" />
            <h3 className="font-bold text-lg">
              {mode === null ? 'إدارة الطلبية البديلة' : mode === 'create' ? 'إنشاء طلبية بديلة جديدة' : 'ربط بطلبية موجودة'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === null ? (
          <div className="p-8 flex flex-col gap-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">إستبدال الطلبية</h4>
              <p className="text-sm text-gray-500">اختر الطريقة التي تفضلها لإستبدال هذه الطلبية المستلمة</p>
            </div>

            <button
              onClick={() => setMode('create')}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-purple-100 hover:border-purple-600 hover:bg-purple-50 transition-all text-right group"
            >
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h5 className="font-bold text-gray-900 mb-1">إنشاء طلبية جديدة</h5>
                <p className="text-xs text-gray-500">سيتم ملء بيانات الزبون تلقائياً، ويمكنك تعديل المنتج والسعر لإنشاء طلبية جديدة بالقسم الخاص بها وربطها تلقائياً.</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </button>

            <button
              onClick={() => setMode('link')}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-indigo-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all text-right group"
            >
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Search className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h5 className="font-bold text-gray-900 mb-1">ربط بطلبية تم إنشاؤها مسبقاً</h5>
                <p className="text-xs text-gray-500">اذا قمت بإنشاء الطلبية البديلة مسبقاً، يمكنك البحث عنها وربطها بهذه الطلبية لتعويض المخزون وحساب الأرباح.</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            </button>
          </div>
        ) : mode === 'create' ? (
          renderCreateForm()
        ) : (
          renderLinkMode()
        )}
      </div>
    </div>
  );
}
