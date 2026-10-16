import React, { useState, useEffect } from 'react';
import { X, Check, Package, Layers, Hash, ShoppingBag, ArrowRightLeft, User, Phone, MapPin, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store';

interface QuickReclassifyModalProps {
  order: any;
  
  
  
  1?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QuickReclassifyModal({ 
  order, onClose,
  onSuccess 
}: QuickReclassifyModalProps) {
  const { inventoryProducts, updateOrder } = useStore();

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productName, setProductName] = useState<string>(order?.productName || '');
  const [selectedVariationId, setSelectedVariationId] = useState<string>('');
  const [variationName, setVariationName] = useState<string>(order?.variation || '');
  const [sku, setSku] = useState<string>(order?.sku || '');
  const [quantity, setQuantity] = useState<number>(Number(order?.qnts) || 1);
  const [isSaving, setIsSaving] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Find if current product matches an inventory item
  useEffect(() => {
    if (!order) return;
    const currentPName = (order.productName || '').trim().toLowerCase();
    const currentSku = (order.sku || '').trim().toLowerCase();

    // Try matching by SKU first
    let matchedP = (inventoryProducts || []).find((p: any) => {
      if (p.sku && p.sku.trim().toLowerCase() === currentSku) return true;
      if (p.variations?.some((v: any) => v.sku && v.sku.trim().toLowerCase() === currentSku)) return true;
      return false;
    });

    // Or by name
    if (!matchedP) {
      matchedP = (inventoryProducts || []).find((p: any) => {
        return p.name && p.name.trim().toLowerCase() === currentPName;
      });
    }

    if (matchedP) {
      setSelectedProductId(matchedP.id);
      setProductName(matchedP.name);

      // Try matching variation
      if (matchedP.variations && matchedP.variations.length > 0) {
        const vText = (order.variation || '').trim().toLowerCase();
        const matchedV = matchedP.variations.find((v: any) => {
          if (v.sku && v.sku.trim().toLowerCase() === currentSku) return true;
          if (v.name && v.name.trim().toLowerCase() === vText) return true;
          const attrText = v.attributes?.map((a: any) => a.option || a.value).join(' ').toLowerCase();
          if (attrText && attrText.includes(vText)) return true;
          return false;
        });

        if (matchedV) {
          setSelectedVariationId(String(matchedV.id || matchedV.sku || ''));
          setVariationName(matchedV.name || matchedV.attributes?.map((a: any) => a.option).join(' - ') || '');
          if (matchedV.sku) setSku(matchedV.sku);
        }
      }
    } else {
      setIsCustomMode(true);
    }
  }, [order, inventoryProducts]);

  const selectedProduct = (inventoryProducts || []).find((p: any) => p.id === selectedProductId);
  const hasVariations = selectedProduct && Array.isArray(selectedProduct.variations) && selectedProduct.variations.length > 0;

  const handleProductSelect = (pId: string) => {
    setSelectedProductId(pId);
    if (!pId) {
      setIsCustomMode(true);
      return;
    }
    const prod = (inventoryProducts || []).find((p: any) => p.id === pId);
    if (prod) {
      setProductName(prod.name);
      if (prod.variations && prod.variations.length > 0) {
        // Select first variation by default
        const firstVar = prod.variations[0];
        setSelectedVariationId(String(firstVar.id || firstVar.sku || ''));
        setVariationName(firstVar.name || firstVar.attributes?.map((a: any) => a.option).join(' - ') || '');
        setSku(firstVar.sku || prod.sku || '');
      } else {
        setSelectedVariationId('');
        setVariationName('');
        setSku(prod.sku || '');
      }
    }
  };

  const handleVariationSelect = (vId: string) => {
    setSelectedVariationId(vId);
    if (!selectedProduct || !selectedProduct.variations) return;
    const v = selectedProduct.variations.find((item: any) => (item.id === vId || item.sku === vId));
    if (v) {
      const vTitle = v.name || v.attributes?.map((a: any) => a.option).join(' - ') || 'نوع';
      setVariationName(vTitle);
      if (v.sku) setSku(v.sku);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order?.id) return;
    if (!productName.trim()) {
      toast.error('يرجى تحديد أو كتابة اسم المنتج');
      return;
    }

    setIsSaving(true);
    try {
      const updatePayload: any = {
        productName: productName.trim(),
        variation: variationName.trim(),
        sku: sku.trim(),
        qnts: Number(quantity) || 1
      };

      // If order has items array with single item, update it too
      const itemsKey = order.line_items ? 'line_items' : (order.products ? 'products' : (order.cart ? 'cart' : (order.orderedItems ? 'orderedItems' : 'items')));
      let rawItems = order[itemsKey];
      let isStringified = false;
      if (typeof rawItems === 'string') {
        try {
          rawItems = JSON.parse(rawItems);
          isStringified = true;
        } catch {}
      }

      if (Array.isArray(rawItems) && rawItems.length === 1) {
        const updatedItems = [{
          ...rawItems[0],
          name: productName.trim(),
          product_name: productName.trim(),
          variation: variationName.trim(),
          sku: sku.trim(),
          quantity: Number(quantity) || 1
        }];
        updatePayload[itemsKey] = isStringified ? JSON.stringify(updatedItems) : updatedItems;
      } else if (Array.isArray(rawItems) && rawItems.length > 1) {
        // Multi-item order: try to find the specific item by variation text
        const targetVar = ('').trim();
        const updatedItems = rawItems.map(item => {
           let itVar = item.variation || item.variation_name || item.variationName || item.variant_title || item.variant || item.options || '';
           if (typeof itVar === 'object' && itVar !== null) {
              itVar = Object.values(itVar).join(' - ');
           }
           if (String(itVar).trim() === targetVar) {
              return {
                 ...item,
                 name: productName.trim(),
                 product_name: productName.trim(),
                 variation: variationName.trim(),
                 sku: sku.trim(),
                 quantity: Number(quantity) || 1
              };
           }
           return item;
        });
        updatePayload[itemsKey] = isStringified ? JSON.stringify(updatedItems) : updatedItems;
      }

      await updateOrder(order.id, updatePayload);
      toast.success('تم تحديث بيانات المنتج والنوع وإعادة تصنيف الطلبية بنجاح!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحديث وتصنيف الطلبية');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[10000] flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">تعديل المنتج وإعادة التصنيف</h3>
              <p className="text-xs font-bold text-slate-400">تعديل نوع أو كمية المنتج ليعاد فرز الطلبية بالتجهيز</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Preview Info */}
        <div className="px-6 py-3 bg-indigo-50/40 border-b border-indigo-100/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-extrabold text-slate-800">{order.fullName || order.customerName || 'زبون'}</span>
            {order.phone && <span className="font-mono text-slate-500 text-[11px]" dir="ltr">({order.phone})</span>}
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-lg">
            #{order.id ? String(order.id).slice(-6).toUpperCase() : order.orderId}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setIsCustomMode(false)}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${!isCustomMode ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              اختيار من المخزن
            </button>
            <button
              type="button"
              onClick={() => setIsCustomMode(true)}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${isCustomMode ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              كتابة يدوية مخصصة
            </button>
          </div>

          {!isCustomMode ? (
            <>
              {/* Select from Inventory */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span>المنتج من المخزن:</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs"
                >
                  <option value="">-- اختر منتجاً من المخزن --</option>
                  {(inventoryProducts || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(SKU: ${p.sku})` : ''} {p.variations?.length ? `[${p.variations.length} أنواع]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Variations dropdown if product has variations */}
              {hasVariations ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-600" />
                    <span>النوع / المقاس / العرض:</span>
                  </label>
                  <select
                    value={selectedVariationId}
                    onChange={(e) => handleVariationSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-purple-50/50 border border-purple-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-xs"
                  >
                    {selectedProduct.variations.map((v: any) => {
                      const vTitle = v.name || v.attributes?.map((a: any) => a.option).join(' - ') || 'نوع';
                      return (
                        <option key={v.id || v.sku} value={v.id || v.sku}>
                          {vTitle} {v.sku ? `(SKU: ${v.sku})` : ''} - السعر: {v.price || selectedProduct.price || 0} د.ج
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : selectedProduct ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold text-xs">
                  هذا المنتج بسيط بدون أنواع ثانوية.
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* Custom Manual Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">اسم المنتج:</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="مثال: ساعة ذكية رياضية Ultra"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">النوع / المقاس / اللون:</label>
                <input
                  type="text"
                  value={variationName}
                  onChange={(e) => setVariationName(e.target.value)}
                  placeholder="مثال: أسود - 42mm أو عرض 2 قطع"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>
            </>
          )}

          {/* SKU & Quantity row */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>رمز SKU:</span>
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-123..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                <span>الكمية (القطع):</span>
              </label>
              <input
                type="number"
                min="1"
                max="999"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>حفظ وإعادة التصنيف فوراً</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
