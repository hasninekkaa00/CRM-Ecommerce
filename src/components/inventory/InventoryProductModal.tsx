import React, { useState, useEffect } from "react";
import { X, Save, Package, Tag, Box, Info, RefreshCcw } from "lucide-react";
import { useStore } from "../../store";
import { SourceChannelBadge } from "../../utils/channelUtils";
import {
  calculateDynamicStock,
  calculateReturnedStock,
  calculateShippedStock,
} from "../../utils/inventoryCalc";

interface Variation {
  id?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
  attributes?: any[];
  local_stock_quantity?: number | null;
  local_price?: string | null;
}

interface InventoryProductModalProps {
  product: any;
  onClose: () => void;
  onSave: (updatedProduct: any) => void;
  isLocalMode: boolean;
  skuPurchasedCounts?: Record<string, number>;
  skuSoldCounts?: Record<string, number>;
}

export function InventoryProductModal({
  product,
  onClose,
  onSave,
  isLocalMode,
}: InventoryProductModalProps) {
  const [editedProduct, setEditedProduct] = useState<any>(null);
  const { purchaseInvoices, orders, salesChannels, settings, suppliers } = useStore();

  useEffect(() => {
    if (product) {
      setEditedProduct(JSON.parse(JSON.stringify(product))); // Deep copy
    }
  }, [product]);

  if (!editedProduct) return null;

  const handleSave = () => {
    onSave(editedProduct);
  };

  const updateVariation = (index: number, field: string, value: any) => {
    if (!editedProduct || !editedProduct.variations) return;
    const updatedVariations = [...editedProduct.variations];
    const targetVar = { ...updatedVariations[index] };

    // Always use local_* fields for edits in local mode or sync mode overrides
    if (field === "price") {
      targetVar.local_price = value;
    } else if (field === "quantity") {
      targetVar.local_stock_quantity = value;
      targetVar.local_manage_stock = true;
    } else if (field === "sku") {
      targetVar.sku = value;
      targetVar.local_sku = value;
    } else {
      targetVar[field] = value;
    }

    updatedVariations[index] = targetVar;
    setEditedProduct({
      ...editedProduct,
      variations: updatedVariations,
    });
  };

  const updateMainProduct = (field: string, value: any) => {
    const updated = { ...editedProduct };
    if (field === "price") {
      updated.local_price = value;
    } else if (field === "quantity") {
      updated.local_stock_quantity = value;
      updated.local_manage_stock = true;
    } else {
      updated[field] = value;
    }
    setEditedProduct(updated);
  };

  const getDisplayPrice = (item: any) => {
    if (
      isLocalMode &&
      item.local_price !== undefined &&
      item.local_price !== null
    )
      return item.local_price;
    if (item.local_price !== undefined && item.local_price !== null)
      return item.local_price; // Prefer local override even in sync? Maybe local edit shouldn't exist in sync, but it's okay for override if user typed it. Let's just follow the local data structure.
    return item.price || item.regular_price || "";
  };

  const getDisplayReturnedQty = (item: any) => {
    if (isLocalMode) {
      const isParent = item.id === editedProduct.id;
      return calculateReturnedStock(item, isParent, editedProduct, orders)
        .pendingQty;
    }
    return 0;
  };

  const getDisplayShippedQty = (item: any) => {
    if (isLocalMode) {
      const isParent = item.id === editedProduct.id;
      return calculateShippedStock(item, isParent, editedProduct, orders);
    }
    return 0;
  };

  const getDisplayQty = (item: any) => {
    if (isLocalMode) {
      const isParent = item.id === editedProduct.id;
      return Math.max(
        0,
        calculateDynamicStock(
          item,
          isParent,
          editedProduct,
          purchaseInvoices,
          orders,
        ),
      );
    }
    return item.stock_quantity ?? item.quantity ?? 0;
  };

  const getRawQty = (item: any) => {
    if (isLocalMode) {
      const isParent = item.id === editedProduct.id;
      return calculateDynamicStock(
        item,
        isParent,
        editedProduct,
        purchaseInvoices,
        orders,
      );
    }
    return item.stock_quantity ?? item.quantity ?? 0;
  };

  const hasVariations =
    editedProduct.variations && editedProduct.variations.length > 0;
  const isOfferFallback =
    hasVariations &&
    editedProduct.variations.some((v: any) =>
      v.attributes?.some(
        (a: any) =>
          a.option &&
          (a.option.includes("عرض") ||
            a.option.includes("كمية") ||
            a.option.includes("pack")),
      ),
    );
  const isOffer =
    editedProduct.local_is_offers !== undefined
      ? editedProduct.local_is_offers
      : isOfferFallback;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/40 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl xl:max-w-5xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[92vh] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-4">
            {editedProduct.image ? (
              <img
                src={editedProduct.image}
                alt={editedProduct.name}
                className="w-16 h-16 rounded-2xl object-cover border border-gray-200 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-200">
                <Package className="w-7 h-7 text-gray-400" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-black text-gray-900">
                {editedProduct.name}
              </h2>
              <div className="text-sm text-gray-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 font-mono text-xs">
                  <Tag className="w-3.5 h-3.5" />
                  SKU: {editedProduct.sku || "غير محدد"}
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                <SourceChannelBadge 
                  order={{ sourceChannel: editedProduct.channelName || 'طلب يدوي / مباشر' }} 
                  size="xs" 
                  configuredSalesChannels={salesChannels} 
                />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {!isLocalMode && (
            <div className="mb-6 bg-blue-50/50 border border-blue-100 text-blue-700 p-4 rounded-2xl flex items-start gap-3">
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
              <div className="text-sm font-medium">
                <strong>وضع التزامن مفعل:</strong> التعديلات التي تجريها هنا
                سيتم تطبيقها محلياً في التطبيق وقد تتأثر عند المزامنة مع المتجر.
                لتفعيل الإدارة المحلية الكاملة، قم بتغيير وضع المخزون من
                الإعدادات.
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Main Product Info (if no variations or global settings) */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 border-b border-gray-50 pb-2">
                التفاصيل الأساسية
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 border border-indigo-100 bg-indigo-50/50 p-4 rounded-xl">
                <div>
                  <label className="block text-xs font-bold text-indigo-800 mb-1.5 flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={!!editedProduct.useShippingAlias}
                      onChange={(e) => updateMainProduct("useShippingAlias", e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500"
                    />
                    تفعيل الاسم المستعار لشركات الشحن
                  </label>
                  <p className="text-[10px] text-indigo-600 mb-2">تفعيل هذا الخيار سيقوم بتمرير هذا الاسم لشركة الشحن بدلاً من الاسم الأصلي (مع الاحتفاظ بالتفرع/Variation).</p>
                </div>
                <div>
                  <input
                    type="text"
                    className="w-full border border-indigo-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all shadow-2xs"
                    value={editedProduct.shippingAliasName || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!editedProduct) return;
                      setEditedProduct({
                        ...editedProduct,
                        shippingAliasName: val,
                        useShippingAlias: val.trim() ? true : editedProduct.useShippingAlias
                      });
                    }}
                    placeholder="مثال: حذاء رياضي (بدون ذكر الماركة)"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 whitespace-nowrap">
                    رمز المنتج (SKU)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all disabled:opacity-50"
                    value={editedProduct.sku || ""}
                    onChange={(e) => updateMainProduct("sku", e.target.value)}
                    placeholder="SKU"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 whitespace-nowrap">
                    السعر الأساسي (د.ج)
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all disabled:opacity-50"
                    value={getDisplayPrice(editedProduct) ?? ''}
                    onChange={(e) => updateMainProduct("price", e.target.value)}
                    placeholder="السعر الأساسي"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 whitespace-nowrap">
                    التكلفة (د.ج)
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all disabled:opacity-50"
                    value={editedProduct.local_cost ?? ''}
                    onChange={(e) =>
                      updateMainProduct(
                        "local_cost",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="تكلفة شراء المنتج"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 whitespace-nowrap">
                    الوزن (كغ)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all disabled:opacity-50"
                    value={editedProduct.weight ?? ''}
                    onChange={(e) =>
                      updateMainProduct(
                        "weight",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="الوزن (كغ)"
                  />
                </div>
              </div>

              <div className="mt-4 p-4 border border-indigo-100 bg-indigo-50/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-indigo-800 mb-1">
                    الكمية الإجمالية الحالية (المقدرة)
                  </div>
                  <div className="text-[10px] text-indigo-600 font-medium">
                    نظراً لأن الإدارة محلية، هذه الكمية تُحسب من فواتير المورد
                    مطروحاً منها الطلبيات التي تم شحنها.
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {(() => {
                    const parentRawQty =
                      hasVariations && !isOffer
                        ? editedProduct.variations.reduce(
                            (sum: number, v: any) => sum + Number(getRawQty(v)),
                            0,
                          )
                        : getRawQty(editedProduct);
                    return (
                      parentRawQty < 0 && (
                        <div className="text-center mr-2">
                          <span className="block text-[10px] text-rose-600 font-bold mb-1">
                            عجز (نقص)
                          </span>
                          <div className="text-2xl font-black text-rose-700 bg-rose-50 px-5 py-2 rounded-lg border border-rose-100 shadow-sm">
                            {Math.abs(parentRawQty)}
                          </div>
                        </div>
                      )
                    );
                  })()}
                  <div className="text-center">
                    <span className="block text-[10px] text-indigo-600 font-bold mb-1">
                      المتاح للبيع
                    </span>
                    <div className="text-2xl font-black text-indigo-700 bg-white px-5 py-2 rounded-lg border border-indigo-100 shadow-sm">
                      {hasVariations && !isOffer
                        ? editedProduct.variations.reduce(
                            (sum: number, v: any) =>
                              sum + Number(getDisplayQty(v)),
                            0,
                          )
                        : getDisplayQty(editedProduct)}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-amber-600 font-bold mb-1">
                      تم الشحن
                    </span>
                    <div className="text-2xl font-black text-amber-700 bg-white px-5 py-2 rounded-lg border border-amber-100 shadow-sm">
                      {hasVariations && !isOffer
                        ? editedProduct.variations.reduce(
                            (sum: number, v: any) =>
                              sum + Number(getDisplayShippedQty(v)),
                            0,
                          )
                        : getDisplayShippedQty(editedProduct)}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-purple-600 font-bold mb-1">
                      روتور عالق
                    </span>
                    <div className="text-2xl font-black text-purple-700 bg-white px-5 py-2 rounded-lg border border-purple-100 shadow-sm">
                      {hasVariations && !isOffer
                        ? editedProduct.variations.reduce(
                            (sum: number, v: any) =>
                              sum + Number(getDisplayReturnedQty(v)),
                            0,
                          )
                        : getDisplayReturnedQty(editedProduct)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <p className="text-[11px] font-bold text-slate-500">
                  لم تعد الكمية قابلة للتعديل اليدوي هنا. يتم حساب المخزون
                  تلقائياً بناءً على فواتير المشتريات والطلبيات (عبر SKU).
                </p>
              </div>
            </div>

            {/* Variations */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-gray-50 pb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-gray-800">
                    تفرعات المنتج وانواعه (
                    {(editedProduct.variations || []).length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newVar = {
                          id: "local_var_" + Date.now(),
                          sku: (editedProduct.sku || "") + "-NEW",
                          price: editedProduct.price,
                          attributes: [{ option: "متغير جديد" }],
                          local_stock_quantity: 0,
                          local_manage_stock: true,
                        };
                        setEditedProduct({
                          ...editedProduct,
                          variations: [
                            ...(editedProduct.variations || []),
                            newVar,
                          ],
                        });
                      }}
                      className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 font-bold transition-colors"
                    >
                      + إضافة
                    </button>
                    <button
                      onClick={() => {
                        const currentVars = editedProduct.variations || [];
                        const restoredVars: any[] = [];
                        const parentName = editedProduct.name;

                        // Look through orders to find variations for this product
                        orders.forEach((o) => {
                          // If order's product name matches this product's name
                          if (o.productName === parentName && o.variation) {
                            // Check if this variation exists
                            const exists =
                              currentVars.some(
                                (v: any) =>
                                  (v.attributes &&
                                    v.attributes.some(
                                      (a: any) => a.option === o.variation,
                                    )) ||
                                  (v.name && v.name.includes(o.variation)),
                              ) ||
                              restoredVars.some(
                                (v) => v.attributes[0].option === o.variation,
                              );

                            if (!exists) {
                              restoredVars.push({
                                id: "restored_" + Date.now() + Math.random(),
                                sku: (editedProduct.sku || "") + "-RESTORED",
                                price: editedProduct.price,
                                attributes: [{ option: o.variation }],
                                local_stock_quantity: 0,
                                local_manage_stock: true,
                              });
                            }
                          }
                        });

                        if (restoredVars.length > 0) {
                          setEditedProduct({
                            ...editedProduct,
                            variations: [...currentVars, ...restoredVars],
                          });
                          alert(
                            `تم استعادة ${restoredVars.length} متغيرات من الطلبيات السابقة.`,
                          );
                        } else {
                          alert(
                            "لم يتم العثور على متغيرات محذوفة في الطلبيات السابقة.",
                          );
                        }
                      }}
                      className="text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 font-bold transition-colors"
                      title="يقوم بالبحث في الطلبيات السابقة واستعادة المتغيرات التي تم حذفها من المتجر لتصحيح حسابات التكلفة"
                    >
                      <RefreshCcw className="w-3 h-3 inline ml-1" />
                      استعادة المحذوف
                    </button>
                  </div>
                </div>
                {hasVariations && (
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <span className="text-xs font-bold text-gray-600">
                      هل هذه التفرعات عبارة عن عروض؟
                    </span>
                    <button
                      onClick={() =>
                        updateMainProduct("local_is_offers", !isOffer)
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isOffer ? "bg-indigo-600" : "bg-gray-200"}`}
                      role="switch"
                      aria-checked={isOffer}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOffer ? "-translate-x-4" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {(editedProduct.variations || []).map(
                  (v: any, index: number) => {
                    const vQtyStr = getDisplayQty(v);
                    const vQtyNum = Number(vQtyStr);
                    const vRawQtyNum = Number(getRawQty(v));
                    const isDeficit = !isOffer && vRawQtyNum < 0;
                    const isLow =
                      !isOffer &&
                      vQtyNum <= (settings?.lowInventoryThreshold || 10) &&
                      vQtyNum >= 0;
                    const bgColor = isDeficit
                      ? "bg-rose-50 border-rose-200"
                      : isLow
                        ? "bg-orange-50 border-orange-200"
                        : "bg-gray-50/50 border-gray-100 hover:bg-gray-50";
                    const titleColor = isDeficit
                      ? "text-rose-800"
                      : isLow
                        ? "text-orange-800"
                        : "text-gray-800";
                    return (
                      <div 
                        key={index} 
                        className={`flex flex-col gap-3.5 p-4 sm:p-5 rounded-2xl border transition-colors shadow-2xs ${bgColor}`}
                      >
                        {/* 1. Header: Variation Title, SKU Badge & Status Badges */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-gray-200/60">
                          <div className={`font-black text-sm flex items-center flex-wrap gap-2.5 ${titleColor}`}>
                            <span className="text-base text-gray-900 shrink-0">
                              {v.attributes?.map((a: any) => a.option).join(" • ") || `تفرع ${index + 1}`}
                            </span>
                            <span className="inline-flex items-center shrink-0 whitespace-nowrap font-mono text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                              SKU: {v.sku || v.local_sku || (editedProduct.sku ? `${editedProduct.sku}-${index + 1}` : "غير محدد")}
                            </span>
                            {isDeficit && (
                              <span className="inline-flex items-center shrink-0 whitespace-nowrap bg-rose-100 text-rose-700 text-[10px] px-2.5 py-0.5 rounded-full font-black">
                                عجز ({Math.abs(vRawQtyNum)})
                              </span>
                            )}
                            {isLow && (
                              <span className="inline-flex items-center shrink-0 whitespace-nowrap bg-orange-100 text-orange-700 text-[10px] px-2.5 py-0.5 rounded-full font-black">
                                منخفض ({vQtyNum})
                              </span>
                            )}
                          </div>
                          {v.shippingAliasName && (
                            <span className="inline-flex items-center shrink-0 whitespace-nowrap bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-lg text-xs font-bold" title="التسمية المستعارة للنوع">
                              🏷️ مستعار: {v.shippingAliasName}
                            </span>
                          )}
                        </div>

                        {/* 2. Middle Row: SKU Input & Shipping Alias Input (Ample, full width, never squished!) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/70 p-3 rounded-xl border border-gray-100">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                              <span className="whitespace-nowrap">رمز SKU للنوع</span>
                              <span className="text-[10px] text-gray-400 font-normal whitespace-nowrap">كود التفرع</span>
                            </label>
                            <input
                              type="text"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs placeholder:text-gray-400"
                              value={v.sku || v.local_sku || ""}
                              onChange={(e) => updateVariation(index, "sku", e.target.value)}
                              placeholder={editedProduct.sku ? `${editedProduct.sku}-${index + 1}` : "مثال: WATCH-BLACK-42"}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-indigo-900 mb-1 flex items-center justify-between">
                              <span className="whitespace-nowrap">تسمية مستعارة للنوع</span>
                              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">للشحن</span>
                            </label>
                            <input
                              type="text"
                              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs placeholder:text-gray-400"
                              value={v.shippingAliasName || ""}
                              onChange={(e) => updateVariation(index, "shippingAliasName", e.target.value)}
                              placeholder="اسم النوع لدى شركة الشحن..."
                            />
                          </div>
                        </div>

                        {/* 3. Bottom Row: Price, Cost, Weight, Quantities */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <div className="w-full sm:w-32 shrink-0">
                            <label className="block text-[10px] uppercase tracking-wider font-black text-gray-500 mb-1">
                              السعر (د.ج)
                            </label>
                            <input
                              type="number"
                              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                              value={getDisplayPrice(v) ?? ''}
                              onChange={(e) => updateVariation(index, "price", e.target.value)}
                              placeholder="السعر"
                            />
                          </div>

                          <div className="w-full sm:w-32 shrink-0">
                            <label className="block text-[10px] uppercase tracking-wider font-black text-gray-500 mb-1">
                              التكلفة (د.ج)
                            </label>
                            <input
                              type="number"
                              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                              value={v.local_cost ?? ''}
                              onChange={(e) => updateVariation(index, "local_cost", e.target.value ? Number(e.target.value) : null)}
                              placeholder="التكلفة"
                            />
                          </div>

                          <div className="w-full sm:w-28 shrink-0">
                            <label className="block text-[10px] uppercase tracking-wider font-black text-gray-500 mb-1">
                              الوزن (كغ)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                              value={v.weight ?? ''}
                              onChange={(e) => updateVariation(index, "weight", e.target.value ? Number(e.target.value) : null)}
                              placeholder="الوزن"
                            />
                          </div>

                          {!isOffer && (
                            <div className="flex items-center gap-2">
                              <div className="w-16 shrink-0">
                                <label className="block text-[10px] uppercase tracking-wider font-black text-gray-500 mb-1" title="للبيع">
                                  متبقي
                                </label>
                                <div className="w-full h-[35px] border border-gray-200 rounded-lg px-2 flex items-center justify-center text-sm font-black text-indigo-700 bg-indigo-50 shadow-2xs">
                                  {getDisplayQty(v)}
                                </div>
                              </div>

                              <div className="w-16 shrink-0">
                                <label className="block text-[10px] uppercase tracking-wider font-black text-gray-500 mb-1" title="طلبيات في حالة تم الشحن">
                                  تم الشحن
                                </label>
                                <div className="w-full h-[35px] border border-gray-200 rounded-lg px-2 flex items-center justify-center text-sm font-black text-amber-700 bg-amber-50 shadow-2xs">
                                  {getDisplayShippedQty(v)}
                                </div>
                              </div>

                              <div className="w-16 shrink-0">
                                <label className="block text-[10px] uppercase tracking-wider font-black text-gray-500 mb-1" title="مرتجع عالق">
                                  ر. عالق
                                </label>
                                <div className="w-full h-[35px] border border-gray-200 rounded-lg px-2 flex items-center justify-center text-sm font-black text-purple-700 bg-purple-50 shadow-2xs">
                                  {getDisplayReturnedQty(v)}
                                </div>
                              </div>
                            </div>
                          )}

                          {isOffer && (
                            <div className="w-full sm:w-32 shrink-0">
                              <label className="block text-[10px] uppercase tracking-wider font-black text-gray-500 mb-1" title="كم قطعة يمثل هذا العرض؟">
                                كمية العرض (حبة)
                              </label>
                              <input
                                type="number"
                                min="1"
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                value={v.offer_quantity ?? 1}
                                onChange={(e) => updateVariation(index, "offer_quantity", parseInt(e.target.value) || 1)}
                                placeholder="الكمية الفردية"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 rounded-b-3xl mt-auto">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            حفظ التعديلات
          </button>
        </div>
      </div>
    </div>
  );
}
