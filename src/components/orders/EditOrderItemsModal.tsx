import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, Plus, Trash2, Package, ShoppingBag, DollarSign, Truck, Scale, Check, Copy, AlertTriangle, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { Order, InventoryProduct } from '../../types';
import { useStore } from '../../store';
import { calculateOrderShippingWeight, formatWeightArabic } from '../../utils/weightUtils';
import { getProductCostValue, lookupInventoryBySku } from '../../utils/productCostUtils';
import { playActionSound } from '../../utils/audioUtils';

interface EditOrderItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | any;
  onSaved?: (updatedOrder: any) => void;
}

interface EditableItem {
  id: string;
  productName: string;
  variation: string;
  sku: string;
  qnts: number;
  price: string | number;
  cost?: string | number;
  weight?: string | number;
}

export function EditOrderItemsModal({ isOpen, onClose, order, onSaved }: EditOrderItemsModalProps) {
  const { inventoryProducts, updateOrder, settings } = useStore();
  const [items, setItems] = useState<EditableItem[]>([]);
  const [deliveryPrice, setDeliveryPrice] = useState<string>('0');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize items from the order
  useEffect(() => {
    if (!isOpen || !order) return;

    setDeliveryPrice(String(order.deliveryPrice ?? 0));

    // Case 1: Order already has structured items array
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      const mapped = order.items.map((it: any) => ({
        id: it.id || uuidv4(),
        productName: it.productName || it.name || '',
        variation: it.variation || it.variationName || '',
        sku: it.sku || '',
        qnts: Number(it.quantity ?? it.qnts ?? 1) || 1,
        price: it.price !== undefined ? it.price : '',
        cost: it.cost !== undefined ? it.cost : '',
        weight: it.weight !== undefined ? it.weight : ''
      }));
      setItems(mapped);
      return;
    }

    // Case 2: Order productName has compound items separated by '+'
    const pName = String(order.productName || '').trim();
    if (pName.includes('+')) {
      const pNames = pName.split('+').map(s => s.trim()).filter(Boolean);
      const vParts = String(order.variation || '').split('+').map(s => s.trim());
      const skuParts = String(order.sku || '').split(/[,;\+]+/).map(s => s.trim()).filter(Boolean);
      const singlePrice = order.priceWithoutDelivery ? (Number(order.priceWithoutDelivery) / Math.max(1, pNames.length)) : '';

      const generated = pNames.map((name, idx) => ({
        id: uuidv4(),
        productName: name,
        variation: vParts[idx] || (vParts.length === 1 ? vParts[0] : ''),
        sku: skuParts[idx] || (skuParts.length === 1 ? skuParts[0] : ''),
        qnts: 1,
        price: singlePrice ? Math.round(singlePrice) : '',
        cost: '',
        weight: ''
      }));
      setItems(generated);
      return;
    }

    // Case 3: Single item order
    const singlePrice = order.priceWithoutDelivery ?? (
      order.totalCharge !== undefined && order.deliveryPrice !== undefined 
        ? Math.max(0, Number(order.totalCharge) - Number(order.deliveryPrice)) 
        : (order.price || '')
    );
    const unitPrice = order.qnts && Number(order.qnts) > 1 && singlePrice 
      ? Math.round(Number(singlePrice) / Number(order.qnts)) 
      : singlePrice;

    setItems([{
      id: uuidv4(),
      productName: order.productName || '',
      variation: order.variation || '',
      sku: order.sku || '',
      qnts: Number(order.qnts) || 1,
      price: unitPrice ?? '',
      cost: order.cost ?? '',
      weight: order.weight ?? ''
    }]);
  }, [isOpen, order]);

  // Calculations
  const productsSubtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qnts) || 1), 0);
  }, [items]);

  const totalPieces = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.qnts) || 1), 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    return productsSubtotal + (Number(deliveryPrice) || 0);
  }, [productsSubtotal, deliveryPrice]);

  const estimatedWeight = useMemo(() => {
    const tempOrder = {
      ...order,
      items: items.map(it => ({
        ...it,
        quantity: it.qnts
      }))
    };
    return calculateOrderShippingWeight(tempOrder, inventoryProducts, settings?.defaultShippingWeight || 1);
  }, [order, items, inventoryProducts, settings]);

  if (!isOpen || !order) return null;

  // Add a new product row
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: uuidv4(),
        productName: '',
        variation: '',
        sku: '',
        qnts: 1,
        price: '',
        cost: '',
        weight: ''
      }
    ]);
  };

  // Remove a product row
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast.error('يجب أن تحتوي الطلبية على منتج واحد على الأقل');
      return;
    }
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // Duplicate a product row
  const handleDuplicateItem = (item: EditableItem) => {
    setItems(prev => [
      ...prev,
      {
        ...item,
        id: uuidv4(),
      }
    ]);
    toast.success('تم تكرار المنتج');
  };

  // Update a field on an item
  const handleUpdateItemField = (id: string, field: keyof EditableItem, value: any) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated: EditableItem = { ...it, [field]: value };
      if (field === 'sku' && value) {
        const invLookup = lookupInventoryBySku(value, inventoryProducts);
        if (invLookup.found) {
          if (!updated.productName || updated.productName === '') updated.productName = invLookup.productName || '';
          if (!updated.variation || updated.variation === '') updated.variation = invLookup.variationName || '';
          if (invLookup.price) updated.price = invLookup.price;
          if (invLookup.cost) updated.cost = invLookup.cost;
          if (invLookup.weight) updated.weight = invLookup.weight;
          toast.success(`تم جلب السعر (${invLookup.price} د.ج) والبيانات من المخزن تلقائياً`, { id: `sku-item-${id}` });
        }
      }
      return updated;
    }));
  };

  // Select from warehouse product & variation
  const handleSelectFromInventory = (id: string, rawVal: string) => {
    if (!rawVal) return;
    try {
      const parsed = JSON.parse(rawVal);
      setItems(prev => prev.map(it => {
        if (it.id !== id) return it;
        return {
          ...it,
          productName: parsed.name || it.productName,
          variation: parsed.variation || it.variation,
          sku: parsed.sku || it.sku,
          price: parsed.price ? Number(parsed.price) : it.price,
          cost: parsed.cost ? Number(parsed.cost) : it.cost,
          weight: parsed.weight ? Number(parsed.weight) : it.weight
        };
      }));
      toast.success('تم اختيار المنتج وتعبئة بياناته تلقائياً');
    } catch (e) {
      console.warn('Inventory select error', e);
    }
  };

  // Save changes
  const handleSave = async () => {
    const validItems = items.filter(it => it.productName.trim() !== '');
    if (validItems.length === 0) {
      toast.error('يرجى كتابة اسم منتج واحد على الأقل');
      return;
    }

    setIsSaving(true);
    try {
      const combinedProductName = validItems.map(i => i.productName.trim()).filter(Boolean).join(' + ');
      const combinedVariation = validItems.map(i => i.variation.trim()).filter(Boolean).join(' + ');
      const combinedSku = validItems.map(i => i.sku.trim()).filter(Boolean).join(', ');
      const finalTotalQnts = validItems.reduce((sum, i) => sum + (Number(i.qnts) || 1), 0);
      const finalPriceWithoutDelivery = validItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qnts) || 1), 0);
      const finalDeliveryPrice = Number(deliveryPrice) || 0;
      const finalTotalCharge = finalPriceWithoutDelivery + finalDeliveryPrice;

      // Clean items array to store in Firestore
      const cleanItems = validItems.map(it => ({
        id: it.id,
        productName: it.productName.trim(),
        name: it.productName.trim(),
        variation: it.variation.trim(),
        sku: it.sku.trim(),
        qnts: Number(it.qnts) || 1,
        quantity: Number(it.qnts) || 1,
        price: Number(it.price) || 0,
        cost: it.cost !== undefined && it.cost !== '' ? Number(it.cost) : undefined,
        weight: it.weight !== undefined && it.weight !== '' ? Number(it.weight) : undefined
      }));

      const finalWeight = calculateOrderShippingWeight(
        { ...order, items: cleanItems },
        inventoryProducts,
        settings?.defaultShippingWeight || 1
      );

      const updates: any = {
        items: cleanItems,
        line_items: cleanItems,
        products: cleanItems,
        cart: cleanItems,
        orderedItems: cleanItems,
        productName: combinedProductName,
        variation: combinedVariation,
        sku: combinedSku,
        qnts: finalTotalQnts,
        priceWithoutDelivery: finalPriceWithoutDelivery,
        deliveryPrice: finalDeliveryPrice,
        totalCharge: finalTotalCharge,
        weight: finalWeight,
        calculatedWeight: finalWeight
      };

      await updateOrder(order.id, updates);
      playActionSound('success');
      toast.success(`تم بنجاح تحديث ${cleanItems.length} منتجات في الطلبية والمبالغ المالية!`);
      
      if (onSaved) {
        onSaved({ ...order, ...updates });
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      playActionSound('error');
      toast.error('حدث خطأ أثناء حفظ تعديلات المنتجات');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">تعديل منتجات الطلبية وإضافة منتجات متعددة</h3>
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full font-mono">
                  #{order.orderId || String(order.id).slice(0, 8)}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                الزبون: <span className="font-bold text-white">{order.fullName || 'بدون اسم'}</span> | الولاية: <span className="font-bold text-white">{order.city || order.region || '-'}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-4">
          
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                قائمة المنتجات في هذه الطلبية ({items.length})
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                (يمكنك إضافة أي عدد من المنتجات، مع تحديد كمية وسعر كل منتج)
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ إضافة منتج آخر للطلبية</span>
            </button>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {items.map((it, idx) => {
              const itemTotal = (Number(it.price) || 0) * (Number(it.qnts) || 1);

              return (
                <div 
                  key={it.id} 
                  className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all flex flex-col gap-3 relative"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-800">
                        {it.productName ? it.productName : `منتج ${idx + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Inventory Quick Picker */}
                      <select
                        value=""
                        onChange={(e) => {
                          handleSelectFromInventory(it.id, e.target.value);
                          e.target.value = '';
                        }}
                        className="text-[11px] font-bold bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg px-2.5 py-1 outline-none transition-all cursor-pointer"
                      >
                        <option value="">⚡ اختر من المخزن تلقائياً...</option>
                        {inventoryProducts?.map(p => {
                          const hasVariations = p.variations && p.variations.length > 0;
                          const pCost = getProductCostValue(p);
                          if (hasVariations) {
                            return (
                              <optgroup key={p.id} label={p.name}>
                                {p.variations.map((v: any, vIdx: number) => {
                                  const varName = v.name || v.attributes?.map((a: any) => a.option).join(' - ') || `تفرع ${vIdx + 1}`;
                                  const varPrice = v.price || p.price || p.regular_price || 0;
                                  const varCost = getProductCostValue(v) || pCost || 0;
                                  const vSku = v.sku || (p.sku ? `${p.sku}-${vIdx + 1}` : '');
                                  const vWeight = v.weight !== undefined && v.weight !== null && String(v.weight).trim() !== '' ? v.weight : (p.weight ?? 0);
                                  const val = JSON.stringify({
                                    sku: vSku,
                                    name: p.name,
                                    variation: varName,
                                    price: varPrice,
                                    cost: varCost,
                                    weight: vWeight
                                  });
                                  return (
                                    <option key={`${p.id}-${vIdx}`} value={val}>
                                      {varName} {vSku ? `[${vSku}]` : ''} - {varPrice} د.ج
                                    </option>
                                  );
                                })}
                              </optgroup>
                            );
                          } else {
                            const basePrice = p.price || p.regular_price || 0;
                            const pWeight = p.weight !== undefined && p.weight !== null && String(p.weight).trim() !== '' ? p.weight : 0;
                            const val = JSON.stringify({
                              sku: p.sku || '',
                              name: p.name,
                              variation: '',
                              price: basePrice,
                              cost: pCost || 0,
                              weight: pWeight
                            });
                            return (
                              <option key={p.id} value={val}>
                                {p.name} {p.sku ? `[${p.sku}]` : ''} - {basePrice} د.ج
                              </option>
                            );
                          }
                        })}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleDuplicateItem(it)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="نسخ هذا المنتج"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف هذا المنتج من الطلبية"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Input Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
                    {/* Product Name */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">اسم المنتج</label>
                      <input
                        type="text"
                        value={it.productName}
                        onChange={(e) => handleUpdateItemField(it.id, 'productName', e.target.value)}
                        placeholder="مثال: حذاء رياضي، عطر فاخر..."
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none transition-all"
                      />
                    </div>

                    {/* Variation */}
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">النوع / الموديل</label>
                      <input
                        type="text"
                        value={it.variation}
                        onChange={(e) => handleUpdateItemField(it.id, 'variation', e.target.value)}
                        placeholder="أسود، XL..."
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none transition-all"
                      />
                    </div>

                    {/* SKU */}
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">رمز SKU</label>
                      <input
                        type="text"
                        value={it.sku}
                        onChange={(e) => handleUpdateItemField(it.id, 'sku', e.target.value)}
                        placeholder="SKU-001"
                        dir="ltr"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-indigo-700 outline-none transition-all"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الكمية</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemField(it.id, 'qnts', Math.max(1, (Number(it.qnts) || 1) - 1))}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-black text-xs transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={it.qnts}
                          onChange={(e) => handleUpdateItemField(it.id, 'qnts', Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="flex-1 min-w-0 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-1 text-center text-xs font-black text-slate-900 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateItemField(it.id, 'qnts', (Number(it.qnts) || 1) + 1)}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-black text-xs transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Unit Price */}
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">سعر الوحدة (د.ج)</label>
                      <input
                        type="number"
                        min="0"
                        value={it.price}
                        onChange={(e) => handleUpdateItemField(it.id, 'price', e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-2 py-1.5 text-xs font-black text-emerald-700 outline-none transition-all text-center"
                      />
                    </div>
                  </div>

                  {/* Subtotal Pill */}
                  <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500 font-bold border-t border-slate-50">
                    <span>إجمالي هذا المنتج:</span>
                    <span className="font-black text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {itemTotal.toLocaleString()} د.ج
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals & Financial Card */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-emerald-50/50 p-4 rounded-3xl border border-indigo-100 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-600" />
              <span>الملخص المالي واللوجستي للطلبية</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Products Subtotal */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500">مجموع أسعار المنتجات</p>
                <p className="text-base font-black text-slate-900 mt-0.5">
                  {productsSubtotal.toLocaleString()} <span className="text-xs font-normal">د.ج</span>
                </p>
                <p className="text-[10px] text-slate-400 font-medium">({totalPieces} قطعة إجمالاً)</p>
              </div>

              {/* Delivery Fee */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500">سعر التوصيل (للزبون)</p>
                <div className="relative mt-0.5">
                  <input
                    type="number"
                    min="0"
                    value={deliveryPrice}
                    onChange={(e) => setDeliveryPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-800 outline-none focus:border-indigo-400"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">د.ج</span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs bg-emerald-50/30">
                <p className="text-[10px] font-bold text-emerald-800">المبلغ الإجمالي (القبض)</p>
                <p className="text-lg font-black text-emerald-700 mt-0.5">
                  {grandTotal.toLocaleString()} <span className="text-xs font-normal">د.ج</span>
                </p>
                <p className="text-[10px] text-emerald-600 font-bold">شامل التوصيل</p>
              </div>

              {/* Parcel Weight */}
              <div className="bg-white p-3 rounded-2xl border border-indigo-200 shadow-2xs bg-indigo-50/30">
                <p className="text-[10px] font-bold text-indigo-800 flex items-center gap-1">
                  <Scale className="w-3 h-3 text-indigo-600" />
                  الميزان الممرر للشحن
                </p>
                <p className="text-base font-black text-indigo-900 mt-0.5">
                  {formatWeightArabic(estimatedWeight)}
                </p>
                <p className="text-[10px] text-indigo-600 font-medium">محسوب بدقة لكل منتج</p>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
              <span className="text-indigo-600 font-black shrink-0">معلومة مهمة:</span>
              <span>
                سيتم تحديث كل الحسابات تلقائياً (تسوية ديون الموردين والكريدي، تقارير المالية والأرباح، وقائمة التجهيز Picking List، ووزن الشحن).
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>حفظ تعديلات المنتجات والمبالغ</span>
          </button>
        </div>

      </div>
    </div>
  );
}
