import React, { useState } from 'react';
import { Calendar, Megaphone, MegaphoneOff, Check, CheckCircle, MapPin, Package, Phone, Truck, User, Hash, Edit3, X, FileText, CornerDownLeft, ArrowRight, Save, RefreshCw, AlertCircle, Map, Tag, Plus, AlignLeft, Clock, StickyNote } from "lucide-react";
import { SearchableSelect } from "../common/SearchableSelect";
import toast from 'react-hot-toast';
import { useStore } from '../../store';
import { SourceChannelBadge } from '../../utils/channelUtils';
import { isNoteFromToday, detectNoteTarget } from '../../utils/noteUtils';
import { getOrderTagsHistory, formatTagTimestamp, addTagToOrder, removeTagFromOrder } from '../../utils/tagUtils';
import { QuickAddTagModal } from './QuickAddTagModal';

interface ViewOrderModalProps {
  order: any;
  onClose: () => void;
}

const getStatus1Badge = (val: string) => {
  switch (val) {
    case 'جديد': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'مؤكد': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ملغى': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'مؤجل': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'قيد المراجعة': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'لا يرد': return 'bg-gray-100 text-gray-700 border-gray-300';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

const getStatus2Badge = (val: string) => {
  switch (val) {
    case 'قيد التجهيز': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'تم الشحن': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'في الطريق': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'مستلم': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'مرتجع': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'قابلة للشحن': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'لم يتم الشحن': return 'bg-slate-100 text-slate-700 border-slate-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};

export function ViewOrderModal({ order, onClose }: ViewOrderModalProps) {
  const {  settings, salesChannels, orders, updateOrder , users } = useStore();
  const [selectedNewTag, setSelectedNewTag] = useState('');
  const [isUpdatingTag, setIsUpdatingTag] = useState(false);
  const [isQuickTagOpen, setIsQuickTagOpen] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [newNoteInput, setNewNoteInput] = useState('');

  if (!order) return null;

  // Get current live reactive order from store if available
  const currentOrder = orders.find((o: any) => o.id === order.id) || order;
  const activeTags = settings?.tags || [];
  const tagsHistory = getOrderTagsHistory(currentOrder, activeTags);

  const status1Options = settings?.status1Options || ['جديد', 'قيد المراجعة', 'مؤكد', 'ملغى', 'مؤجل', 'لا يرد'];
  const status2Options = settings?.status2Options || ['لم يتم الشحن', 'قيد التجهيز', 'تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'قابلة للشحن'];
  const confirmers = Array.from(new Set(users.filter(u => u.role === 'confirmer' || (u.commissionConfig && u.isActive)).map(u => u.displayName).filter(Boolean)));
  const defaultDeliveryList = ['ياليدين', 'مايسترو', 'زد آر إكسبريس', 'إيكوتراك', 'أرامكس', 'توصيل محلي'];
  const customDelivery = Array.isArray(settings?.deliveryCompanies)
    ? settings.deliveryCompanies 
    : defaultDeliveryList;
  const integrationDelivery = settings?.shippingIntegrations?.filter(i => i.isActive).map(i => i.name).filter(Boolean) || [];
  const deliveryCompanies = Array.from(new Set([...customDelivery, ...integrationDelivery, currentOrder.deliveryCompany].filter(Boolean)));

  const handleUpdateStatus1 = async (newStatus1: string) => {
    if (newStatus1 === currentOrder.status1 || isSavingStatus) return;
    setIsSavingStatus(true);
    try {
      await updateOrder(currentOrder.id, { status1: newStatus1 });
      toast.success(`تم تغيير حالة التأكيد إلى "${newStatus1}" بنجاح`);
    } catch (error) {
      toast.error('تعذر تحديث حالة الطلبية');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleUpdateStatus2 = async (newStatus2: string) => {
    if (newStatus2 === currentOrder.status2 || isSavingStatus) return;
    setIsSavingStatus(true);
    try {
      await updateOrder(currentOrder.id, { status2: newStatus2 });
      toast.success(`تم تغيير حالة التوصيل إلى "${newStatus2}" بنجاح`);
    } catch (error) {
      toast.error('تعذر تحديث حالة التوصيل');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleUpdateField = async (field: string, value: any, successMsg?: string) => {
    setIsSavingStatus(true);
    try {
      await updateOrder(currentOrder.id, { [field]: value });
      if (successMsg) {
        toast.success(successMsg);
      }
    } catch (error) {
      toast.error('تعذر تحديث البيانات');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!tagName || isUpdatingTag) return;
    setIsUpdatingTag(true);
    try {
      const res = addTagToOrder(currentOrder, tagName, activeTags);
      await updateOrder(currentOrder.id, { tag: res.tag, tagsHistory: res.tagsHistory });
      setSelectedNewTag('');
      toast.success(`تم إضافة التاغ "${tagName}"`);
    } catch (err) {
      console.error('Error adding tag:', err);
      toast.error('تعذر إضافة التاغ');
    } finally {
      setIsUpdatingTag(false);
    }
  };

  const handleRemoveTag = async (tagEntryId: string) => {
    if (!tagEntryId || isUpdatingTag) return;
    setIsUpdatingTag(true);
    try {
      const res = removeTagFromOrder(currentOrder, tagEntryId, activeTags);
      await updateOrder(currentOrder.id, { tag: res.tag, tagsHistory: res.tagsHistory });
      toast.success('تم حذف التاغ من السجل');
    } catch (err) {
      console.error('Error removing tag:', err);
      toast.error('تعذر حذف التاغ');
    } finally {
      setIsUpdatingTag(false);
    }
  };

  const handleAppendNote = async () => {
    if (!newNoteInput.trim()) return;
    const currentNotes = currentOrder.notes ? `${currentOrder.notes}\n${newNoteInput.trim()}` : newNoteInput.trim();
    await handleUpdateField('notes', currentNotes, 'تم إضافة الملاحظة بنجاح');
    setNewNoteInput('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-600" />
              تفاصيل الطلبية #{currentOrder.orderId || currentOrder.id}
            </h2>
            <SourceChannelBadge order={currentOrder} size="md" configuredSalesChannels={salesChannels} />
            
            {currentOrder.trashed && (
              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-black flex items-center gap-1 shadow-2xs">
                🗑️ محذوفة في سلة المهملات
              </span>
            )}
            {currentOrder.consignmentSettlementId && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-sm">
                <FileText className="w-3.5 h-3.5" />
                تمت تسوية الكريدي مع المورد
              </span>
            )}
            {(currentOrder.archived || currentOrder.isArchived) && (
              <span className="px-2.5 py-1 bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-black flex items-center gap-1 shadow-2xs">
                📦 طلبية مؤرشفة
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 custom-scrollbar">
            
            {/* Quick Status Control Panel */}
            <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border border-indigo-100/80 rounded-2xl p-4 shadow-sm">
               <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-indigo-100/60">
                  <div className="flex items-center gap-2">
                     <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                        <Edit3 className="w-4 h-4" />
                     </span>
                     <div>
                        <h3 className="text-xs font-black text-slate-800">إدارة وتعديل حالة الطلبية</h3>
                        <p className="text-[11px] text-slate-500 font-medium">يمكنك تغيير حالة التأكيد والتوصيل وحفظها مباشرة</p>
                     </div>
                  </div>
                  {isSavingStatus && (
                     <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> جاري الحفظ...
                     </span>
                  )}
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status 1 (Confirmation) */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                     <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                           <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                           حالة التأكيد (1):
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getStatus1Badge(currentOrder.status1 || '')}`}>
                           {currentOrder.status1 || 'غير محدد'}
                        </span>
                     </div>
                     <div className="flex flex-wrap gap-1.5">
                        {status1Options.map((s) => {
                           const isSelected = currentOrder.status1 === s;
                           return (
                              <button
                                 key={s}
                                 type="button"
                                 onClick={() => handleUpdateStatus1(s)}
                                 disabled={isSavingStatus}
                                 className={`text-[11px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                    isSelected
                                       ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-200'
                                       : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                 }`}
                              >
                                 {isSelected && <Check className="w-3 h-3" />}
                                 <span>{s}</span>
                              </button>
                           );
                        })}
                     </div>

                     {/* Postponement Date (If postponed or editable) */}
                     {(currentOrder.status1 === 'مؤجل' || currentOrder.postponementDate) && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                           <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                           <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">تاريخ التأجيل:</span>
                           <input
                              type="date"
                              value={currentOrder.postponementDate || ''}
                              onChange={(e) => handleUpdateField('postponementDate', e.target.value, 'تم تحديث تاريخ التأجيل')}
                              className="w-full text-xs font-bold bg-purple-50/50 border border-purple-200 rounded-lg px-2 py-1 text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-400"
                           />
                        </div>
                     )}

                     {/* Confirmed By */}
                     <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">المؤكد بواسطة:</span>
                        {confirmers.length > 0 ? (
                           <SearchableSelect
                              value={currentOrder.confirmedBy || ''}
                              onChange={(val) => handleUpdateField('confirmedBy', val, 'تم تحديث اسم المؤكد')}
                              options={confirmers}
                              placeholder="- غير محدد -"
                           />
                        ) : (
                           <input
                              type="text"
                              defaultValue={currentOrder.confirmedBy || ''}
                              onBlur={(e) => handleUpdateField('confirmedBy', e.target.value, 'تم تحديث اسم المؤكد')}
                              placeholder="اسم موظف التأكيد"
                              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                           />
                        )}
                     </div>
                  </div>

                  {/* Status 2 (Delivery & Shipping) */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                     <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                           <Truck className="w-3.5 h-3.5 text-indigo-600" />
                           حالة التوصيل (2):
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getStatus2Badge(currentOrder.status2 || '')}`}>
                           {currentOrder.status2 || 'غير محدد'}
                        </span>
                     </div>
                     <div className="flex flex-wrap gap-1.5">
                        {status2Options.map((s) => {
                           const isSelected = currentOrder.status2 === s;
                           return (
                              <button
                                 key={s}
                                 type="button"
                                 onClick={() => handleUpdateStatus2(s)}
                                 disabled={isSavingStatus}
                                 className={`text-[11px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                    isSelected
                                       ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                                       : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                 }`}
                              >
                                 {isSelected && <Check className="w-3 h-3" />}
                                 <span>{s}</span>
                              </button>
                           );
                        })}
                     </div>

                     {/* Delivery Company */}
                     <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">شركة الشحن:</span>
                        <SearchableSelect
                              value={currentOrder.deliveryCompany || ''}
                              onChange={(val) => handleUpdateField('deliveryCompany', val, 'تم تحديث شركة الشحن')}
                              options={deliveryCompanies}
                              placeholder="- اختر شركة التوصيل -"
                           />
                     </div>

                     {/* Tracking Number */}
                     <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">رقم التتبع:</span>
                        <input
                           type="text"
                           defaultValue={currentOrder.shippingTrackingId || ''}
                           onBlur={(e) => {
                              if (e.target.value !== (currentOrder.shippingTrackingId || '')) {
                                 handleUpdateField('shippingTrackingId', e.target.value.trim() || null, 'تم تحديث رقم التتبع');
                              }
                           }}
                           placeholder="مثال: YA123456"
                           dir="ltr"
                           className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                     </div>
                  </div>
               </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Client Info */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> معلومات الزبون</h3>
                   <div className="space-y-2">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-slate-400 font-bold">الاسم الكامل</span>
                         <span className="text-sm font-bold text-slate-800">{currentOrder.fullName}</span>
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[10px] text-slate-400 font-bold">رقم الهاتف</span>
                         <a href={`tel:${currentOrder.phone}`} className="text-sm font-mono font-bold text-indigo-600 flex items-center gap-1 w-fit hover:underline" dir="ltr">
                            <Phone className="w-3.5 h-3.5" />
                            {currentOrder.phone}
                         </a>
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[10px] text-slate-400 font-bold">طريقة التوصيل</span>
                         <span className="text-sm font-bold text-slate-700">{currentOrder.shippingMethod || '-'}</span>
                      </div>
                   </div>
                </div>

                {/* Location Info */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> العنوان</h3>
                   <div className="space-y-2">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-slate-400 font-bold">الولاية</span>
                         <span className="text-sm font-bold text-slate-800">{currentOrder.city}</span>
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[10px] text-slate-400 font-bold">البلدية</span>
                         <span className="text-sm font-bold text-slate-800">{currentOrder.region || '-'}</span>
                      </div>
                      {currentOrder.stopdeskCommune && (
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold">مكتب التوصيل (Stopdesk)</span>
                            <span className="text-sm font-bold text-indigo-700">{currentOrder.stopdeskCommune}</span>
                         </div>
                      )}
                      <div className="flex flex-col border-t border-slate-100 pt-2 mt-2">
                         <span className="text-[10px] text-slate-400 font-bold">العنوان التفصيلي</span>
                         <span className="text-xs font-medium text-slate-600 leading-relaxed">{currentOrder.address || '-'}</span>
                      </div>
                   </div>
                </div>
                
                {/* Product Info */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> المنتج وتفاصيله</h3>
                   <div className="space-y-2 flex-col flex">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-slate-400 font-bold">المنتج</span>
                         <span className="text-sm font-bold text-slate-800">{currentOrder.productName}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 mt-2">
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold">النوع (Variation)</span>
                            <span className="text-xs font-bold text-indigo-600">{currentOrder.variation || '-'}</span>
                         </div>
                         <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 font-bold">الكمية</span>
                            <span className="text-sm font-black text-slate-800 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">{currentOrder.qnts || 1}</span>
                         </div>
                      </div>
                      {currentOrder.sku && (
                        <div className="flex flex-col mt-2">
                           <span className="text-[10px] text-slate-400 font-bold">رمز المنتج (SKU)</span>
                           <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded w-fit border border-slate-200">{currentOrder.sku}</span>
                        </div>
                      )}
                      {currentOrder.items && currentOrder.items.length > 0 && (
                          <div className="mt-3">
                              <span className="text-[10px] text-slate-400 font-bold mb-1 block">المنتجات المرتبطة (العرض):</span>
                              <div className="bg-orange-50 border border-orange-100 rounded-lg p-2 flex flex-col gap-1.5">
                                  {currentOrder.items.map((it:any, idx:number) => (
                                      <div key={idx} className="flex justify-between items-center text-[11px] font-bold">
                                          <span className="text-orange-900">{it.name} {it.variation ? `- ${it.variation}` : ''}</span>
                                          <span className="bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded">x{it.quantity}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                   </div>
                </div>

                {/* Financials & Status */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> الأموال والأسعار</h3>
                   <div className="space-y-2">
                      <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                         <span className="text-[11px] text-slate-500 font-bold">سعر المنتج</span>
                         <span className="text-sm font-bold text-slate-800">{currentOrder.priceWithoutDelivery || ((Number(currentOrder.totalCharge) || 0) - (Number(currentOrder.deliveryPrice) || 0))} د.ج</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                         <span className="text-[11px] text-slate-500 font-bold">شحن الزبون</span>
                         <span className="text-sm font-bold text-rose-600">{currentOrder.deliveryPrice === 0 ? 'مجاني' : `${currentOrder.deliveryPrice} د.ج`}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                         <span className="text-[11px] text-amber-800 font-bold">شحن الشركة الأصلي (المخصوم في المالية)</span>
                         <span className="text-sm font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                           {currentOrder.realDeliveryPrice !== undefined && Number(currentOrder.realDeliveryPrice) > 0 ? `${currentOrder.realDeliveryPrice} د.ج` : `${currentOrder.deliveryPrice || 0} د.ج`}
                         </span>
                      </div>
                      <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 p-2 rounded-xl mt-2">
                         <span className="text-xs text-emerald-700 font-black">المبلغ الإجمالي (القبض)</span>
                         <span className="text-base font-black text-emerald-700">{currentOrder.totalCharge || 0} د.ج</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="flex flex-col">
                             <span className="text-[10px] text-slate-400 font-bold">حالة التأكيد</span>
                             <span className={`text-xs font-bold px-2 py-0.5 rounded border w-fit ${getStatus1Badge(currentOrder.status1 || '')}`}>{currentOrder.status1 || '-'}</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[10px] text-slate-400 font-bold">حالة التوصيل</span>
                             <span className={`text-xs font-bold px-2 py-0.5 rounded border w-fit ${getStatus2Badge(currentOrder.status2 || '')}`}>{currentOrder.status2 || '-'}</span>
                          </div>
                      </div>
                   </div>
                </div>
            </div>

            {/* Remarks, Tags History & Tracking */}
            <div className="grid grid-cols-1 gap-4">
               {/* Tags History Section */}
               <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                 <div className="flex items-center justify-between">
                   <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                     <Tag className="w-4 h-4 text-indigo-600" />
                     سجل التاغات والعلامات المضافة للطلبية ({tagsHistory.length})
                   </h3>
                   <div className="flex items-center gap-2">
                     <select
                       value={selectedNewTag}
                       onChange={(e) => {
                         const val = e.target.value;
                         if (val === '__CREATE_NEW_TAG__') {
                           setIsQuickTagOpen(true);
                           setSelectedNewTag('');
                         } else if (val) {
                           handleAddTag(val);
                         }
                       }}
                       disabled={isUpdatingTag}
                       className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-black text-xs px-2.5 py-1 rounded-xl cursor-pointer focus:outline-none transition-all"
                     >
                       <option value="">+ إضافة تاغ للطلبية...</option>
                       <option value="__CREATE_NEW_TAG__" className="text-indigo-600 font-black bg-indigo-50">✨ + إنشاء تاغ جديد وحفظه...</option>
                       {activeTags.map((opt: any) => (
                         <option key={opt.name} value={opt.name}>
                           {opt.name}
                         </option>
                       ))}
                     </select>
                     <button
                       type="button"
                       onClick={() => setIsQuickTagOpen(true)}
                       title="إنشاء تاغ جديد وحفظه في السحابة"
                       className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-colors cursor-pointer shrink-0"
                     >
                       <Plus className="w-3.5 h-3.5" />
                       <span>تاغ جديد</span>
                     </button>
                   </div>
                 </div>

                 {tagsHistory.length === 0 ? (
                   <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs font-bold text-slate-400">
                     لا توجد تاغات مسجلة لهذه الطلبية حتى الآن. يمكنك إضافة تاغ من القائمة أعلاه.
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {tagsHistory.map((t) => (
                       <div
                         key={t.id}
                         className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-2xs ${
                           t.color || 'bg-slate-50 border-slate-200 text-slate-800'
                         }`}
                       >
                         <div className="flex items-center gap-2 truncate">
                           <Tag className="w-3.5 h-3.5 shrink-0 opacity-70" />
                           <span className="font-black text-xs truncate">{t.name}</span>
                         </div>

                         <div className="flex items-center gap-2 shrink-0">
                           {t.createdAt && (
                             <span className="text-[10px] opacity-75 font-mono dir-ltr flex items-center gap-1 bg-white/50 px-1.5 py-0.5 rounded-md">
                               <Clock className="w-2.5 h-2.5" />
                               {formatTagTimestamp(t.createdAt)}
                             </span>
                           )}
                           <button
                             type="button"
                             onClick={() => handleRemoveTag(t.id)}
                             disabled={isUpdatingTag}
                             className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white/80 rounded-md transition-all cursor-pointer"
                             title="حذف هذا التاغ من السجل"
                           >
                             <X className="w-3.5 h-3.5" />
                           </button>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               {/* Notes Section with Quick Add */}
               <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                   <div className="flex items-center justify-between">
                     <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5"><AlignLeft className="w-3.5 h-3.5 text-amber-500" /> ملاحظات ومعلومات الطلبية</h3>
                   </div>
                   
                   <div className="flex flex-col gap-2">
                      <div className="flex flex-col p-4 bg-amber-50/80 border border-amber-200/60 rounded-2xl shadow-sm">
                         <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-200/50">
                            <StickyNote className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-amber-800 font-black tracking-wide">ملاحظات الطلبية المسجلة</span>
                         </div>
                         <div className="text-sm font-medium text-amber-900 leading-relaxed whitespace-pre-wrap">
                           {currentOrder.notes ? (
                             <div className="space-y-1.5">
                               {currentOrder.notes.split('\n').filter((n: string) => n.trim() !== '').map((noteLine: string, idx: number) => {
                                 const isToday = isNoteFromToday(noteLine);
                                 const noteTarget = detectNoteTarget(noteLine);
                                 return (
                                   <div
                                     key={idx}
                                     className={`p-2.5 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-between gap-2 ${
                                       isToday && noteTarget === 'driver'
                                         ? 'bg-orange-50 border-2 border-orange-500 text-orange-950 font-black'
                                         : isToday
                                         ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-black'
                                         : 'bg-white/80 border border-amber-200/80 text-slate-800'
                                     }`}
                                   >
                                     <div className="flex items-center gap-2 truncate">
                                       {noteTarget === 'driver' ? (
                                         <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 shadow-2xs">
                                           <Truck className="w-3 h-3" />
                                           ملاحظة ليفرور
                                         </span>
                                       ) : (
                                         <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 shadow-2xs">
                                           <User className="w-3 h-3" />
                                           ملاحظة زبون
                                         </span>
                                       )}
                                       <span className="truncate">{noteLine}</span>
                                     </div>
                                     {isToday && (
                                       <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shrink-0">
                                         🟢 اليوم
                                       </span>
                                     )}
                                   </div>
                                 );
                               })}
                             </div>
                           ) : (
                             <span className="text-amber-700/50 italic">لا توجد ملاحظات مسجلة لهذه الطلبية</span>
                           )}
                         </div>

                         {/* Add New Note input */}
                         <div className="mt-3 pt-3 border-t border-amber-200/60 flex items-center gap-2">
                            <input
                              type="text"
                              value={newNoteInput}
                              onChange={(e) => setNewNoteInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAppendNote();
                                }
                              }}
                              placeholder="أضف ملاحظة جديدة للطلبية واضغط إدخال..."
                              className="flex-1 text-xs bg-white border border-amber-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 font-medium"
                            />
                            <button
                              type="button"
                              onClick={handleAppendNote}
                              disabled={!newNoteInput.trim()}
                              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              إضافة
                            </button>
                         </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                         {currentOrder.deliveryCompany && (
                            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <Truck className="w-3.5 h-3.5 text-slate-400" />
                               <span className="text-[11px] font-bold text-slate-600">الشحن: {currentOrder.deliveryCompany}</span>
                            </div>
                         )}
                         {(currentOrder.deliveryType || currentOrder.shippingMethod) && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                               <span className="text-[11px] font-bold text-indigo-700">التوصيل: {currentOrder.deliveryType || currentOrder.shippingMethod}</span>
                            </div>
                         )}
                         {currentOrder.shippingTrackingId && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <Hash className="w-3.5 h-3.5 text-indigo-400" />
                               <span className="text-[11px] font-bold text-indigo-700 font-mono">طرد: {currentOrder.shippingTrackingId}</span>
                            </div>
                         )}
                         {currentOrder.postponementDate && (
                            <div className="bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <Calendar className="w-3.5 h-3.5 text-orange-400" />
                               <span className="text-[11px] font-bold text-orange-700">مؤجلة إلى: {currentOrder.postponementDate}</span>
                            </div>
                         )}
                         {currentOrder.orderDate && (
                            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <Calendar className="w-3.5 h-3.5 text-slate-400" />
                               <span className="text-[11px] font-bold text-slate-600">طلب في: {currentOrder.orderDate.substring(0,10)}</span>
                            </div>
                         )}
                         {currentOrder.confirmedBy && (
                            <div className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                               <span className="text-[11px] font-bold text-emerald-700">تأكيد: {currentOrder.confirmedBy}</span>
                            </div>
                         )}
                         {currentOrder.ip && (
                            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-slate-500 font-mono">IP: {currentOrder.ip}</span>
                            </div>
                         )}
                         {currentOrder.utmSource && (
                            <div className="bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <MegaphoneOff className="w-3.5 h-3.5 text-teal-500" />
                               <span className="text-[11px] font-bold text-teal-700">المصدر: {currentOrder.utmSource}</span>
                            </div>
                         )}
                         {currentOrder.utmCampaign && (
                            <div className="bg-sky-50 border border-sky-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <MegaphoneOff className="w-3.5 h-3.5 text-sky-500" />
                               <span className="text-[11px] font-bold text-sky-700">الحملة: {currentOrder.utmCampaign}</span>
                            </div>
                         )}
                         {currentOrder.utmMedium && (
                            <div className="bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-violet-700">المجموعة: {currentOrder.utmMedium}</span>
                            </div>
                         )}
                         {currentOrder.utmContent && (
                            <div className="bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-amber-700">الإعلان: {currentOrder.utmContent}</span>
                            </div>
                         )}
                         {currentOrder.pysLanding && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-indigo-700">صفحة الهبوط (PYS): {currentOrder.pysLanding}</span>
                            </div>
                         )}
                         {currentOrder.pysSource && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-indigo-700">مصدر الحركة (PYS): {currentOrder.pysSource}</span>
                            </div>
                         )}
                         {currentOrder.pysFirstVisit && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-indigo-700">الزيارة الأولى (PYS): {currentOrder.pysFirstVisit}</span>
                            </div>
                         )}
                         {currentOrder.pysLastVisit && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-indigo-700">الزيارة الأخيرة (PYS): {currentOrder.pysLastVisit}</span>
                            </div>
                         )}
                         {currentOrder.pysUtmSource && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-indigo-700">مصدر بكسل: {currentOrder.pysUtmSource}</span>
                            </div>
                         )}
                         {currentOrder.pysUtmMedium && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-indigo-700">وسيط بكسل: {currentOrder.pysUtmMedium}</span>
                            </div>
                         )}
                         {currentOrder.pysUtmCampaign && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-[11px] font-bold text-indigo-700">حملة بكسل: {currentOrder.pysUtmCampaign}</span>
                            </div>
                         )}
                      </div>
                   </div>
               </div>

               {/* Tracking History */}
               {currentOrder.trackingHistory && currentOrder.trackingHistory.length > 0 && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                     <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> مسار ونشاط الطلبية</h3>
                     <div className="flex flex-col gap-3 relative border-r-2 border-indigo-100 pr-3 mt-2">
                         {[...currentOrder.trackingHistory]
                             .filter((h: any) => h.remarque || h.status || h.station)
                             .reverse()
                             .map((note: any, i: number) => (
                             <div key={i} className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-right relative">
                                 <div className={`absolute w-3 h-3 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-slate-300'} -right-[19px] top-4 border-2 border-white`}></div>
                                 {note.status && (
                                     <div className={`text-[11px] font-black mb-1 ${i === 0 ? 'text-indigo-600' : 'text-slate-500'}`}>
                                         {note.status}
                                     </div>
                                 )}
                                 {note.remarque && (
                                     <div className="text-[12px] font-bold text-slate-700 leading-relaxed">
                                         {note.remarque}
                                     </div>
                                 )}
                                 {(note.livreur || note.date || note.station) && (
                                     <div className="flex flex-wrap items-center justify-between mt-1 pt-1 gap-2 text-[9.5px]">
                                         <div className="flex items-center gap-2">
                                             {note.livreur && <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-[1px] rounded flex gap-1 items-center"><User className="w-2.5 h-2.5"/> {note.livreur}</span>}
                                             {note.station && <span className="text-slate-500 bg-white border border-slate-100 px-1.5 py-[1px] rounded">{note.station}</span>}
                                         </div>
                                         {note.date && <span className="text-slate-400 font-mono" dir="ltr">{note.date}</span>}
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                  </div>
               )}
            </div>

        </div>
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
           <button 
             onClick={onClose}
             className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
           >
             إغلاق
           </button>
        </div>
      </div>
      <QuickAddTagModal
        isOpen={isQuickTagOpen}
        targetOrder={currentOrder}
        onClose={() => setIsQuickTagOpen(false)}
      />
    </div>
  );
}
