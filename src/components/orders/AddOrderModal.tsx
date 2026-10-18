import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { X, Package, User, Plus, Trash2, Truck, CheckCircle2, FileText, Search, Check, Sparkles, Tag as TagIcon, ShoppingBag } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { WILAYAS_MAP } from '../../utils/algeriaWilayas';
import ecotrackCommunes from '../../ecotrack-communes.json';
import { ShippingDeskInfo } from '../shipping/ShippingDeskInfo';
import { CHANNEL_PRESETS } from '../../utils/channelUtils';
import { TAGS_OPTIONS } from './OrdersList';
import { QuickAddTagModal } from './QuickAddTagModal';
import { DEFAULT_TAGS } from '../../utils/tagUtils';
import { calculateDefaultShippingFee } from '../../utils/shippingFees';

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

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddOrderModal({ isOpen, onClose }: AddOrderModalProps) {
  const {  addOrder, inventoryProducts, salesChannels, settings , users } = useStore();

  const status1List = settings?.status1Options?.length 
    ? settings.status1Options 
    : ['جديد', 'مؤكد', 'ملغى', 'مؤجل', 'قيد المراجعة', 'لا يرد'];

  const status2List = settings?.status2Options?.length 
    ? settings.status2Options 
    : ['', 'قيد التجهيز', 'قابلة للشحن', 'تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'];

  const [isQuickTagModalOpen, setIsQuickTagModalOpen] = useState(false);
  const activeTags = (settings?.tags && settings.tags.length > 0) ? settings.tags : DEFAULT_TAGS;
  const confirmersList = Array.from(new Set(users.filter(u => u.role === 'confirmer' || (u.commissionConfig && u.isActive)).map(u => u.displayName).filter(Boolean)));
  const defaultDeliveryList = ['ياليدين', 'مايسترو', 'زد آر إكسبريس', 'إيكوتراك', 'أرامكس', 'توصيل محلي'];
  const customDelivery = Array.isArray(settings?.deliveryCompanies)
    ? settings.deliveryCompanies 
    : defaultDeliveryList;
  const integrationDelivery = settings?.shippingIntegrations?.filter(i => i.isActive).map(i => i.name).filter(Boolean) || [];
  const deliveryCompaniesList = Array.from(new Set([...customDelivery, ...integrationDelivery]));
  const [formData, setFormData] = useState({
    orderId: '',
    sourceChannel: 'المتجر الإلكتروني',
    fullName: '',
    phone: '',
    region: '',
    city: '',
    shippingMethod: 'توصيل للمنزل',
    stopdeskCommune: '',
    deliveryCompany: settings?.defaultDeliveryCompany || '',
    confirmedBy: settings?.defaultConfirmedBy || '',
    status1: settings?.defaultStatus1 || 'جديد',
    status2: settings?.defaultStatus2 || '',
    tag: '',
    postponementDate: '',
    productName: '',
    variation: '',
    sku: '',
    qnts: 1,
    priceWithoutDelivery: '',
    deliveryPrice: '',
    realDeliveryPrice: '',
    notes: '',
    items: [{ id: uuidv4(), productName: '', variation: '', sku: '', qnts: 1, price: '' }],
  });

  const handleAutoCalcShipping = (regionStr?: string, methodStr?: string) => {
    const reg = regionStr !== undefined ? regionStr : formData.region;
    const method = methodStr !== undefined ? methodStr : formData.shippingMethod;
    const wilayaCode = getWilayaCode(reg);
    const wilayaId = wilayaCode ? parseInt(wilayaCode, 10) : 16;
    const isStopDesk = method.includes('المكتب') || method.includes('Stop');
    const calculated = calculateDefaultShippingFee(wilayaId, isStopDesk);

    setFormData(prev => ({
      ...prev,
      realDeliveryPrice: calculated.realDeliveryPrice.toString(),
      deliveryPrice: prev.deliveryPrice === '' || prev.deliveryPrice === '0' 
        ? calculated.suggestedCustomerDeliveryPrice.toString() 
        : prev.deliveryPrice
    }));
    toast.success(`تم حساب سعر الشحن الأصلي: ${calculated.realDeliveryPrice} د.ج`);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Update defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        deliveryCompany: prev.deliveryCompany || settings?.defaultDeliveryCompany || '',
        confirmedBy: prev.confirmedBy || settings?.defaultConfirmedBy || '',
        status1: prev.status1 || settings?.defaultStatus1 || 'جديد',
        status2: prev.status2 || settings?.defaultStatus2 || '',
      }));
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const totalProductsPrice = formData.items ? formData.items.reduce((acc, item) => acc + (Number(item.price) || 0) * (Number(item.qnts) || 1), 0) : ((Number(formData.priceWithoutDelivery) || 0) * (Number(formData.qnts) || 1));
  const totalCharge = totalProductsPrice + Number(formData.deliveryPrice || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      let finalCity = formData.city.trim();
      if (finalCity.toLowerCase().includes('ain azal') || finalCity.includes('عين ازال') || finalCity.includes('عين أزال')) {
        finalCity = 'Ain Azel';
      }

      const newOrder = {
        id: uuidv4(),
        orderId: formData.orderId || Math.floor(100000 + Math.random() * 900000).toString(),
        // sku handled below
        orderDate: new Date().toISOString(),
        fullName: formData.fullName,
        phone: formData.phone,
        region: formData.region,
        city: finalCity,
        shippingMethod: formData.shippingMethod,
        stopdeskCommune: formData.stopdeskCommune,
        productName: formData.items ? formData.items.map(i => i.productName).filter(Boolean).join(' + ') : formData.productName,
        variation: formData.items ? formData.items.map(i => i.variation).filter(Boolean).join(' + ') : formData.variation,
        sku: formData.items ? formData.items.map(i => i.sku).filter(Boolean).join(' + ') : formData.sku,
        qnts: formData.items ? formData.items.reduce((acc, i) => acc + (Number(i.qnts) || 1), 0) : (Number(formData.qnts) || 1),
        priceWithoutDelivery: formData.items ? formData.items.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.qnts) || 1), 0) : ((Number(formData.priceWithoutDelivery) || 0) * (Number(formData.qnts) || 1)),
        items: formData.items ? formData.items.map(i => ({
          id: i.id || uuidv4(),
          productId: (i as any).productId || '',
          variationId: (i as any).variationId || '',
          name: i.productName,
          sku: i.sku,
          quantity: Number(i.qnts) || 1,
          price: Number(i.price) || 0,
          cost: (i as any).cost !== undefined && Number((i as any).cost) > 0 ? Number((i as any).cost) : undefined,
          variation: i.variation
        })) : [],
        deliveryPrice: Number(formData.deliveryPrice) || 0,
        realDeliveryPrice: formData.realDeliveryPrice !== '' ? Number(formData.realDeliveryPrice) : Number(formData.deliveryPrice) || 0,
        totalCharge: totalCharge,
        confirmedBy: formData.confirmedBy,
        status1: formData.status1 || 'جديد',
        deliveryCompany: formData.deliveryCompany,
        postponementDate: formData.postponementDate || '',
        status2: formData.status2 || '',
        ip: '',
        tag: formData.tag,
        tagsHistory: formData.tag ? [{
          id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: formData.tag,
          color: settings?.tags?.find((t: any) => t.name === formData.tag)?.color || 'bg-indigo-50 border-indigo-200 text-indigo-700',
          createdAt: new Date().toISOString(),
        }] : [],
        sourceChannel: formData.sourceChannel || 'المتجر الإلكتروني',
        notes: formData.notes || '',
      };

      await addOrder(newOrder);
      toast.success('تم إضافة الطلبية بنجاح!');
      onClose();

      // Reset form
      setFormData({
        orderId: '',
        sourceChannel: 'المتجر الإلكتروني',
        fullName: '',
        phone: '',
        region: '',
        city: '',
        shippingMethod: 'توصيل للمنزل',
        stopdeskCommune: '',
        deliveryCompany: settings?.defaultDeliveryCompany || '',
        confirmedBy: settings?.defaultConfirmedBy || '',
        status1: settings?.defaultStatus1 || 'جديد',
        status2: settings?.defaultStatus2 || '',
        tag: '',
        postponementDate: '',
        productName: '',
        variation: '',
        sku: '',
        qnts: 1,
        priceWithoutDelivery: '',
        deliveryPrice: '',
        realDeliveryPrice: '',
        notes: '',
    items: [{ id: uuidv4(), productName: '', variation: '', sku: '', qnts: 1, price: '' }],
  });
      } catch (error: any) {
      console.error('Error adding order:', error);
      setSubmitError(error?.message || 'حدث خطأ أثناء حفظ الطلبية، يرجى المحاولة مرة أخرى.');
      toast.error('حدث خطأ أثناء إضافة الطلبية');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md text-indigo-300">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">إضافة طلبية جديدة</h3>
              <p className="text-xs text-indigo-200 font-medium">تعبئة حقول الطلبية واختيار المنتج من المخزن بالـ SKU</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
          <form id="add-order-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* 📦 Section 1: Product & Inventory Selection */}
            <div className="bg-indigo-50/40 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-indigo-100 pb-2 gap-2">
                <div className="flex items-center gap-2 text-indigo-900 font-black text-sm">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span>المنتجات (يمكنك إضافة أكثر من منتج للطلبية)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      items: [...(prev.items || []), { id: uuidv4(), productName: '', variation: '', sku: '', qnts: 1, price: '' }]
                    }));
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة منتج آخر
                </button>
              </div>

              {(formData.items || []).map((item, index) => (
                <div key={item.id} className="p-3 bg-white border border-indigo-100 rounded-xl relative shadow-sm">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          items: prev.items.filter(i => i.id !== item.id)
                        }));
                      }}
                      className="absolute top-2 left-2 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف المنتج"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="mb-3 pr-8 sm:pr-0">
                    <label className="block text-[10px] font-bold text-indigo-950 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      اختر منتج من المخزن (اختياري لتعبئة الحقول تلقائياً):
                    </label>
                    <select
                      className="w-full border-2 border-indigo-200 bg-slate-50 rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={
                        item.sku
                          ? JSON.stringify({ sku: item.sku, name: item.productName, variation: item.variation || '', price: Number(item.price) || 0 })
                          : ''
                      }
                      onChange={(e) => {
                        if (!e.target.value) return;
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            items: prev.items.map(i => i.id === item.id ? {
                              ...i,
                              sku: parsed.sku,
                              productName: parsed.name,
                              variation: parsed.variation,
                              price: parsed.price.toString(),
                              cost: parsed.cost,
                              productId: parsed.productId,
                              variationId: parsed.variationId
                            } : i)
                          }));
                          toast.success(`تم اختيار المنتج: ${parsed.name}`);
                        } catch (err) {}
                      }}
                    >
                      <option value="">-- اضغط لاختيار منتج من القائمة (مرتب بالـ SKU) --</option>
                      {inventoryProducts?.map(p => {
                        const hasVariations = p.variations && p.variations.length > 0;
                        if (hasVariations) {
                          return (
                            <optgroup key={p.id} label={`📦 ${p.name}`}>
                              {p.variations.map((v, vIdx) => {
                                const varName = v.attributes?.map((a) => a.option).join(' - ') || `تفرع ${vIdx + 1}`;
                                const varPrice = v.price || p.price || p.regular_price || 0;
                                const varCost = v.local_cost || v.cost || v.purchase_price || p.local_cost || p.cost || p.purchase_price || 0;
                                const vSku = v.sku || v.local_sku || (p.sku ? `${p.sku}-${vIdx + 1}` : '');
                                const val = JSON.stringify({ sku: vSku, name: p.name, variation: varName, price: varPrice, cost: varCost, productId: p.id, variationId: v.id });
                                return (
                                  <option key={`${p.id}-${vIdx}`} value={val}>
                                    {varName} | SKU: [{vSku || 'بدون'}] | السعر: {varPrice} د.ج
                                  </option>
                                );
                              })}
                            </optgroup>
                          );
                        } else {
                          const basePrice = p.price || p.regular_price || 0;
                          const baseCost = p.local_cost || p.cost || p.purchase_price || 0;
                          const val = JSON.stringify({ sku: p.sku || '', name: p.name, variation: '', price: basePrice, cost: baseCost, productId: p.id, variationId: '' });
                          return (
                            <option key={p.id} value={val}>
                              📦 {p.name} | SKU: [{p.sku || 'بدون'}] | السعر: {basePrice} د.ج
                            </option>
                          );
                        }
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-gray-700 mb-0.5">اسم المنتج *</label>
                      <input
                        type="text"
                        required
                        value={item.productName ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, productName: val } : i) }));
                        }}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                        placeholder="الاسم"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-gray-700 mb-0.5">النوع / اللون / المقاس</label>
                      <input
                        type="text"
                        value={item.variation ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, variation: val } : i) }));
                        }}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="مثال: XL - أسود"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-indigo-700 mb-0.5">رمز SKU</label>
                      <input
                        type="text"
                        value={item.sku ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, sku: val } : i) }));
                        }}
                        className="w-full border-2 border-indigo-200 bg-indigo-50 rounded-lg px-2 py-1.5 text-[11px] font-mono font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="PROD-102"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-gray-700 mb-0.5">الكمية *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.qnts ?? 1}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 1;
                          setFormData(prev => ({ ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, qnts: val } : i) }));
                        }}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-[11px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-700 mb-0.5">سعر القطعة (د.ج) *</label>
                      <input
                        type="number"
                        required
                        value={item.price ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, price: val } : i) }));
                        }}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="4500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Delivery and Total */}
              <div className="bg-indigo-100/50 p-3 rounded-xl border border-indigo-200 mt-2">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-indigo-900 mb-1">سعر التوصيل (د.ج) *</label>
                    <input
                      type="number"
                      required
                      value={formData.deliveryPrice ?? ''}
                      onChange={e => setFormData({ ...formData, deliveryPrice: e.target.value })}
                      className="w-full border-2 border-indigo-300 bg-white rounded-xl px-3 py-2 text-sm font-black text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      placeholder="600"
                    />
                  </div>
                  <div className="flex-[2] w-full bg-white p-3 rounded-xl border-2 border-indigo-500 shadow-sm flex items-center justify-between">
                    <span className="text-sm font-black text-slate-700">الإجمالي الشامل (المنتجات + التوصيل):</span>
                    <span className="text-xl font-black text-emerald-600" dir="ltr">
                      {totalCharge.toLocaleString()} <span className="text-sm text-emerald-700">DZD</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 👤 Section 2: Customer Info */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-black text-sm border-b border-slate-200 pb-2">
                <User className="w-4 h-4 text-slate-600" />
                <span>معلومات الزبون والعنوان</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">اسم الزبون الكامل *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName ?? ''}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="الاسم واللقب"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف *</label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={formData.phone ?? ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="05 55 55 55 55"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الولاية *</label>
                  <select
                    required
                    value={getWilayaCode(formData.region)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const label = WILAYAS_MAP[val];
                        const codeNum = parseInt(val, 10);
                        const isDesk = formData.shippingMethod.includes('المكتب') || formData.shippingMethod.includes('Stop');
                        const calc = calculateDefaultShippingFee(codeNum, isDesk);
                        setFormData(prev => ({
                          ...prev,
                          region: label,
                          city: '',
                          stopdeskCommune: '',
                          realDeliveryPrice: calc.realDeliveryPrice.toString(),
                          deliveryPrice: (prev.deliveryPrice === '' || prev.deliveryPrice === '0') ? calc.suggestedCustomerDeliveryPrice.toString() : prev.deliveryPrice
                        }));
                      } else {
                        setFormData({ ...formData, region: '', city: '', stopdeskCommune: '' });
                      }
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">المدينة / البلدية *</label>
                  {(() => {
                    const wilayaCode = getWilayaCode(formData.region);
                    const wilayaId = wilayaCode ? parseInt(wilayaCode, 10) : null;
                    const communes = wilayaId 
                      ? (ecotrackCommunes as any[]).filter((c: any) => c.wilaya_id === wilayaId) 
                      : [];

                    if (communes.length > 0) {
                      return (
                        <select
                          required
                          value={formData.city || ''}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">اختر البلدية...</option>
                          {communes.map((c, idx) => (
                            <option key={`add-commune-${idx}`} value={c.nom}>
                              {c.nom} {c.has_stop_desk === 1 ? '🏪 (مكتب متوفر)' : ''}
                            </option>
                          ))}
                        </select>
                      );
                    } else {
                      return (
                        <input
                          type="text"
                          required
                          value={formData.city ?? ''}
                          onChange={e => setFormData({ ...formData, city: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="المدينة"
                        />
                      );
                    }
                  })()}
                </div>
              </div>
            </div>

            {/* 🚚 Section 3: Shipping & Delivery */}
            <div className="bg-sky-50/40 p-4 sm:p-5 rounded-2xl border border-sky-100 space-y-4">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <div className="flex items-center gap-2 text-sky-900 font-black text-sm">
                  <Truck className="w-4 h-4 text-sky-600" />
                  <span>خيارات التوصيل وحساب أسعار الشحن</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAutoCalcShipping()}
                  className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 transition-all flex items-center gap-1 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  حساب تلقائي للأسعار
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">طريقة التوصيل *</label>
                  <select
                    value={formData.shippingMethod ?? 'توصيل للمنزل'}
                    onChange={e => {
                      const newMethod = e.target.value;
                      setFormData(prev => ({ ...prev, shippingMethod: newMethod }));
                      handleAutoCalcShipping(undefined, newMethod);
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="توصيل للمنزل">🏠 توصيل للمنزل (à domicile)</option>
                    <option value="استلام من المكتب (Stop Desk)">🏪 استلام من المكتب (Stop Desk)</option>
                  </select>
                </div>

                {formData.shippingMethod.includes('المكتب') && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">بلدية المكتب (Stop Desk)</label>
                    <input
                      type="text"
                      value={formData.stopdeskCommune ?? ''}
                      onChange={e => setFormData({ ...formData, stopdeskCommune: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="اسم بلدية المكتب"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">شركة التوصيل</label>
                  <select
                    value={formData.deliveryCompany ?? ''}
                    onChange={e => setFormData({ ...formData, deliveryCompany: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- اختر شركة التوصيل --</option>
                    {deliveryCompaniesList.map((company, idx) => (
                      <option key={idx} value={company}>{company}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1 flex items-center justify-between">
                    <span>سعر التوصيل للزبون (د.ج) *</span>
                    <span className="text-[10px] text-indigo-600 font-normal">(يضاف للمجموع)</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.deliveryPrice ?? ''}
                    onChange={e => setFormData({ ...formData, deliveryPrice: e.target.value })}
                    className="w-full border-2 border-indigo-200 rounded-xl px-3 py-2 text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    placeholder="مثال: 600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center justify-between">
                    <span>سعر الشحن الأصلي/الشركة (د.ج)</span>
                    <span className="text-[10px] text-amber-700 font-normal">(تكلفة حساب الأرباح)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.realDeliveryPrice ?? ''}
                    onChange={e => setFormData({ ...formData, realDeliveryPrice: e.target.value })}
                    className="w-full border-2 border-amber-200 bg-amber-50/50 rounded-xl px-3 py-2 text-sm font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder={formData.deliveryPrice ? `تلقائي (${formData.deliveryPrice})` : 'السعر الأصلي'}
                  />
                </div>
              </div>

              {/* Quick Actions for Shipping Fees */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sky-100">
                <span className="text-xs font-bold text-slate-500">خيارات سريعة:</span>
                <button
                  type="button"
                  onClick={() => handleAutoCalcShipping()}
                  className="px-2.5 py-1 bg-sky-100 text-sky-800 hover:bg-sky-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  ⚡ إعادة حساب السعر تلقائياً
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, deliveryPrice: '0' }))}
                  className="px-2.5 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg text-xs font-bold transition-all"
                >
                  🎁 شحن مجاني للزبون (0 د.ج)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, deliveryPrice: prev.realDeliveryPrice || prev.deliveryPrice }))}
                  className="px-2.5 py-1 bg-slate-200 text-slate-800 hover:bg-slate-300 rounded-lg text-xs font-bold transition-all"
                >
                  🔄 مطابقة سعر الزبون مع الأصلي
                </button>
              </div>
            </div>

            {/* ⚙️ Section 4: Statuses, Channels, Tag, Confirmer */}
            <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
              <div className="flex items-center gap-2 text-gray-800 font-black text-sm border-b border-gray-200 pb-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>حالات الطلبية، التأكيد، والتصنيف</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">حالة 1 (حالة العقد) *</label>
                  <select
                    value={formData.status1 ?? 'جديد'}
                    onChange={e => setFormData({ ...formData, status1: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {status1List.map((s, idx) => (
                      <option key={idx} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {formData.status1 === 'مؤجل' && (
                  <div>
                    <label className="block text-xs font-bold text-purple-700 mb-1">تاريخ التأجيل</label>
                    <input
                      type="date"
                      value={formData.postponementDate ?? ''}
                      onChange={e => setFormData({ ...formData, postponementDate: e.target.value })}
                      className="w-full border border-purple-300 bg-purple-50 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">حالة 2 (حالة الشحن)</label>
                  <select
                    value={formData.status2 ?? ''}
                    onChange={e => setFormData({ ...formData, status2: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">(فارغة - غير مشحون بعد)</option>
                    {status2List.filter(Boolean).map((s, idx) => (
                      <option key={idx} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">المؤكد / المسؤول</label>
                  <select
                    value={formData.confirmedBy ?? ''}
                    onChange={e => setFormData({ ...formData, confirmedBy: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- اختر المسؤول --</option>
                    {confirmersList.map((confirmer, idx) => (
                      <option key={idx} value={confirmer}>{confirmer}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">قناة البيع / المصدر</label>
                  <select
                    value={formData.sourceChannel ?? ''}
                    onChange={e => setFormData({ ...formData, sourceChannel: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {salesChannels && salesChannels.length > 0 && (
                      <optgroup label="--- قنوات البيع المربوطة ---">
                        {salesChannels.map(sc => (
                          <option key={sc.id} value={sc.name}>
                            {sc.name} ({sc.type})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="--- قنوات أخرى ---">
                      {CHANNEL_PRESETS.map(ch => (
                                <option key={'preset-'+ch.id} value={ch.name}>
                          {ch.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">تاغ الطلبية</label>
                    <button
                      type="button"
                      onClick={() => setIsQuickTagModalOpen(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>تاغ جديد</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={formData.tag ?? ''}
                      onChange={e => {
                        if (e.target.value === '__CREATE_NEW_TAG__') {
                          setIsQuickTagModalOpen(true);
                        } else {
                          setFormData({ ...formData, tag: e.target.value });
                        }
                      }}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">بدون تاغ</option>
                      <option value="__CREATE_NEW_TAG__" className="text-indigo-600 font-extrabold bg-indigo-50">✨ + إنشاء تاغ جديد وحفظه...</option>
                      {activeTags.map((t: any, idx: number) => (
                        <option key={t.name || idx} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsQuickTagModalOpen(true)}
                      title="إنشاء تاغ جديد وحفظه في السحابة"
                      className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">رقم الطلب (#الطلب - اختياري)</label>
                  <input
                    type="text"
                    value={formData.orderId ?? ''}
                    onChange={e => setFormData({ ...formData, orderId: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="تلقائي إن تُرك فارغاً"
                  />
                </div>
              </div>
            </div>

            {/* 📝 Section 5: Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-gray-500" />
                ملاحظات وتفاصيل إضافية للطلبية
              </label>
              <textarea
                rows={2}
                value={formData.notes ?? ''}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="أدخل أي ملاحظات خاصة بالزبون، العنوان، أو التوصيل..."
              />
            </div>

          </form>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl text-center font-bold">
              {submitError}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3 bg-gray-50/80">
          <div className="text-xs font-bold text-slate-500 hidden sm:block">
            المجموع الإجمالي: <span className="font-black text-indigo-900 text-sm">{totalCharge} د.ج</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 flex-1 sm:flex-none transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              form="add-order-form"
              disabled={isSubmitting}
              className="px-7 py-2.5 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-98 disabled:bg-indigo-400 flex-1 sm:flex-none transition-all shadow-md"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ الطلبية'}
            </button>
          </div>
        </div>

      </div>

      <QuickAddTagModal
        isOpen={isQuickTagModalOpen}
        onTagCreated={(newTag) => {
          setFormData(prev => ({ ...prev, tag: newTag.name }));
        }}
        onClose={() => setIsQuickTagModalOpen(false)}
      />
    </div>
  );
}

