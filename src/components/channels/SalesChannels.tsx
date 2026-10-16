import React, { useState } from 'react';
import { Store, Settings2, Plus, ShoppingCart, RefreshCw, CheckCircle2, AlertCircle, Trash2, Image, Upload, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store';
import { SalesChannel } from '../../types';
import { SourceChannelBadge } from '../../utils/channelUtils';
import { universalSyncWooCommerce } from '../../utils/universalWooCommerceApi';
import { checkSalesChannelDeletionIntegrity, IntegrityCheckResult } from '../../utils/dataIntegrity';
import { IntegrityProtectionModal } from '../common/IntegrityProtectionModal';

const PRESET_LOGOS = [
  { name: 'شركة توصيل', url: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
  { name: 'طرد / كولي', url: 'https://cdn-icons-png.flaticon.com/512/7542/7542670.png' },
  { name: 'WooCommerce', url: 'https://cdn-icons-png.flaticon.com/512/888/888879.png' },
  { name: 'Shopify', url: 'https://cdn-icons-png.flaticon.com/512/11104/11104230.png' },
  { name: 'Facebook', url: 'https://cdn-icons-png.flaticon.com/512/5968/5968764.png' },
  { name: 'Instagram', url: 'https://cdn-icons-png.flaticon.com/512/3955/3955024.png' },
  { name: 'TikTok', url: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png' },
  { name: 'WhatsApp', url: 'https://cdn-icons-png.flaticon.com/512/3670/3670051.png' },
  { name: 'Google', url: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' },
];

export function SalesChannels() {
  const { salesChannels, orders, abandonedOrders, settings, addSalesChannel, updateSalesChannel, deleteSalesChannel, addOrder, addAbandonedOrder, setSyncProgress } = useStore();
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
 
  // Delete & Integrity states
  const [channelToDelete, setChannelToDelete] = useState<SalesChannel | null>(null);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);
  const [integrityBlockResult, setIntegrityBlockResult] = useState<IntegrityCheckResult | null>(null);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [blockedChannel, setBlockedChannel] = useState<SalesChannel | null>(null);

  // Sync states
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState<Record<string, { type: 'success' | 'error', message: string }>>({});
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleInitiateDeleteChannel = (channel: SalesChannel) => {
    const check = checkSalesChannelDeletionIntegrity(channel, {
      orders,
      abandonedOrders,
      settings
    });

    if (!check.canDelete) {
      setIntegrityBlockResult(check);
      setBlockedChannel(channel);
      setShowIntegrityModal(true);
      return;
    }

    setChannelToDelete(channel);
  };

  const handleConfirmDeleteChannel = async () => {
    if (!channelToDelete) return;
    setIsDeletingChannel(true);
    try {
      await deleteSalesChannel(channelToDelete.id);
      toast.success(`تم حذف قناة "${channelToDelete.name}" بنجاح`);
      setChannelToDelete(null);
    } catch (e: any) {
      if (e?.name === 'DataIntegrityError') {
        setChannelToDelete(null);
        setIntegrityBlockResult({
          canDelete: false,
          title: e.title || 'محظور لحماية تماسك البيانات',
          reason: e.message,
          details: e.details || [],
          suggestions: e.suggestions || []
        });
        setShowIntegrityModal(true);
      } else {
        toast.error('حدث خطأ أثناء حذف القناة');
      }
    } finally {
      setIsDeletingChannel(false);
    }
  };

  const handleSafeDeactivateChannel = async () => {
    if (blockedChannel) {
      await updateSalesChannel(blockedChannel.id, { isActive: false });
      toast.success(`تم تعطيل قناة "${blockedChannel.name}" مع الحفاظ على كافة السجلات والطلبيات.`);
      setBlockedChannel(null);
    }
  };

  const handleToggleActive = async (channel: SalesChannel) => {
    await updateSalesChannel(channel.id, { isActive: !channel.isActive });
  };
 
  const handleSyncWooCommerce = async (channel: SalesChannel) => {
    setIsSyncing(prev => ({ ...prev, [channel.id]: true }));
    setSyncStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[channel.id];
      return newStatus;
    });
 
    try {
      const targetStatus = channel.config?.syncStatus || 'processing';

      // 1. Fetch orders
      const data = await universalSyncWooCommerce({
        storeUrl: channel.config.storeUrl,
        consumerKey: channel.config.consumerKey,
        consumerSecret: channel.config.consumerSecret,
        status: targetStatus,
        channelName: channel.name
      });
 
      let importedOrders = 0;
 
      if (data.success && data.orders) {
        for (const order of data.orders) {
          const uniqueId = String(order.id).startsWith('WOO-') ? order.id : `WOO-${channel.id}-${order.id}`;
          const newOrder = {
             ...order,
             id: uniqueId,
             orderId: String(order.orderId || order.id),
             sourceChannel: order.sourceChannel || channel.name
          };
          await addOrder(newOrder);
          importedOrders++;
        }
      } else {
        throw new Error(data.message || 'فشل سحب الطلبيات من المتجر.');
      }

      // 2. Fetch "pending" and "on-hold" orders for Abandoned Carts
      const dataPending = await universalSyncWooCommerce({
        storeUrl: channel.config.storeUrl,
        consumerKey: channel.config.consumerKey,
        consumerSecret: channel.config.consumerSecret,
        status: 'pending,on-hold',
        channelName: channel.name
      });

      let importedPending = 0;

      if (dataPending.success && dataPending.orders) {
        for (const order of dataPending.orders) {
          const uniqueAbnId = String(order.id).startsWith('WOO-ABN-') ? order.id : `WOO-ABN-${channel.id}-${order.id}`;
          const newAbandoned = {
             ...order,
             id: uniqueAbnId,
             orderId: String(order.orderId || order.id),
             sourceChannel: order.sourceChannel || channel.name,
             status: 'لم يتم التواصل',
             notes: order.notes || ''
          };
          await addAbandonedOrder(newAbandoned);
          importedPending++;
        }
      }

      setSyncStatus(prev => ({ 
        ...prev, 
        [channel.id]: { 
          type: 'success', 
          message: `تم سحب ${importedOrders} طلبية و ${importedPending} سلة متروكة بنجاح.` 
        } 
      }));
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.message?.includes('Failed to fetch') 
          ? `تعذر الاتصال بالخادم. يرجى التأكد من عمل المتجر.` 
          : (error.message || 'خطأ في الاتصال بالخادم.');
      setSyncStatus(prev => ({ 
        ...prev, 
        [channel.id]: { 
          type: 'error', 
          message: errorMsg 
        } 
      }));
    } finally {
      setIsSyncing(prev => ({ ...prev, [channel.id]: false }));
    }
  };

  const handleSyncAllChannels = async () => {
    const activeWooChannels = salesChannels.filter(c => c.type === 'woocommerce' && c.isActive);
    if (activeWooChannels.length === 0) {
      alert('لا توجد قنوات WooCommerce مفعلة للسحب.');
      return;
    }

    setIsSyncingAll(true);
    setSyncProgress({ isSyncing: true, message: 'بدء سحب الطلبيات من كافة القنوات...', percent: 10, label: 'بدء السحب' });

    let totalImportedOrders = 0;
    let totalImportedAbandoned = 0;
    const summaries: string[] = [];

    for (let i = 0; i < activeWooChannels.length; i++) {
      const channel = activeWooChannels[i];
      setSyncProgress({
        isSyncing: true,
        message: `سحب الطلبات من: ${channel.name}...`,
        percent: 20 + Math.round((i / activeWooChannels.length) * 70),
        label: `${channel.name}`
      });

      try {
        const targetStatus = channel.config?.syncStatus || 'processing';
        const data = await universalSyncWooCommerce({
          storeUrl: channel.config.storeUrl,
          consumerKey: channel.config.consumerKey,
          consumerSecret: channel.config.consumerSecret,
          status: targetStatus,
          channelName: channel.name
        });

        let chOrders = 0;
        if (data.success && data.orders) {
          for (const order of data.orders) {
            const uniqueId = String(order.id).startsWith('WOO-') ? order.id : `WOO-${channel.id}-${order.id}`;
            await addOrder({
              ...order,
              id: uniqueId,
              orderId: String(order.orderId || order.id),
              sourceChannel: order.sourceChannel || channel.name
            });
            chOrders++;
          }
        }

        // Abandoned
        const dataPending = await universalSyncWooCommerce({
          storeUrl: channel.config.storeUrl,
          consumerKey: channel.config.consumerKey,
          consumerSecret: channel.config.consumerSecret,
          status: 'pending,on-hold',
          channelName: channel.name
        });

        let chAbn = 0;
        if (dataPending.success && dataPending.orders) {
          for (const order of dataPending.orders) {
            const uniqueAbnId = String(order.id).startsWith('WOO-ABN-') ? order.id : `WOO-ABN-${channel.id}-${order.id}`;
            await addAbandonedOrder({
              ...order,
              id: uniqueAbnId,
              orderId: String(order.orderId || order.id),
              sourceChannel: order.sourceChannel || channel.name,
              status: 'لم يتم التواصل',
              notes: order.notes || ''
            });
            chAbn++;
          }
        }

        totalImportedOrders += chOrders;
        totalImportedAbandoned += chAbn;
        summaries.push(`${channel.name}: (${chOrders} طلبية, ${chAbn} سلة)`);
        setSyncStatus(prev => ({
          ...prev,
          [channel.id]: {
            type: 'success',
            message: `تم سحب ${chOrders} طلبية و ${chAbn} سلة بنجاح.`
          }
        }));
      } catch (err: any) {
        setSyncStatus(prev => ({
          ...prev,
          [channel.id]: {
            type: 'error',
            message: err.message || 'فشل الاتصال'
          }
        }));
      }
    }

    setSyncProgress({ isSyncing: true, message: 'اكتمل سحب جميع القنوات!', percent: 100, label: 'مكتمل' });
    setTimeout(() => {
      setSyncProgress(null);
      setIsSyncingAll(false);
    }, 2000);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" />
            قنوات البيع
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">إدارة المتاجر ومصادر الطلبيات (WooCommerce, Shopify...)</p>
        </div>
        <div className="flex items-center gap-2">
          {salesChannels.some(c => c.type === 'woocommerce' && c.isActive) && (
            <button
              onClick={handleSyncAllChannels}
              disabled={isSyncingAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span>{isSyncingAll ? 'جاري سحب كافة القنوات...' : 'سحب وتحديث جميع القنوات'}</span>
            </button>
          )}
          <button 
            onClick={() => setIsAddingChannel(true)}
            className="bg-blue-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة قناة جديدة</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {salesChannels.map((channel) => {
          const channelOrdersCount = orders.filter(o => 
            (o.sourceChannel && o.sourceChannel.trim().toLowerCase() === channel.name.trim().toLowerCase()) ||
            (o.id && (o.id.startsWith(`WOO-${channel.id}-`) || o.id.startsWith(`WOO-${channel.name}-`)))
          ).length;

          const channelAbandonedCount = abandonedOrders.filter(o => 
            (o.sourceChannel && o.sourceChannel.trim().toLowerCase() === channel.name.trim().toLowerCase()) ||
            (o.id && (o.id.startsWith(`WOO-ABN-${channel.id}-`) || o.id.startsWith(`WOO-ABN-${channel.name}-`)))
          ).length;

          return (
            <div key={channel.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center p-1.5 border shadow-2xs ${
                    channel.logoUrl ? 'bg-white border-gray-200' : channel.type === 'woocommerce' ? 'bg-[#7F54B3] text-white border-purple-600' : 'bg-green-600 text-white border-green-700'
                  }`}>
                    {channel.logoUrl ? (
                      <img src={channel.logoUrl} alt={channel.name} className="w-full h-full object-contain" />
                    ) : channel.type === 'woocommerce' ? (
                      <ShoppingCart className="w-6 h-6" />
                    ) : (
                      <Store className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-800">{channel.name}</h3>
                    <div className="mt-1">
                      <SourceChannelBadge 
                        order={{ sourceChannel: channel.name }} 
                        size="xs" 
                        configuredSalesChannels={salesChannels} 
                      />
                    </div>
                  </div>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    value="" 
                    className="sr-only peer" 
                    checked={channel.isActive}
                    onChange={() => handleToggleActive(channel)}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-bold">الرابط:</span>
                    <span className="text-gray-800 font-mono text-[11px] truncate max-w-[200px]" dir="ltr">{channel.config.storeUrl || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-bold">حالة السحب المحددة:</span>
                    <span className="text-blue-700 font-bold text-[11px] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {channel.config.syncStatus === 'any' || channel.config.syncStatus === 'all' 
                        ? 'كافة الحالات' 
                        : channel.config.syncStatus === 'processing,on-hold,pending' 
                        ? 'قيد التنفيذ + المعلقة' 
                        : channel.config.syncStatus || 'قيد التنفيذ (processing)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-100">
                    <span className="text-gray-500 font-bold">الطلبيات المسجلة:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{channelOrdersCount} طلبية</span>
                      {channelAbandonedCount > 0 && (
                        <span className="text-amber-700 font-bold text-[10px] bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">{channelAbandonedCount} سلة</span>
                      )}
                    </div>
                  </div>
                </div>

                {syncStatus[channel.id] && (
                  <div className={`p-2 rounded-lg text-[11px] font-bold mb-3 flex items-center gap-1.5 ${syncStatus[channel.id].type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {syncStatus[channel.id].type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    {syncStatus[channel.id].message}
                  </div>
                )}

                <div className="flex gap-2 mt-auto">
                  {channel.type === 'woocommerce' && channel.isActive && (
                    <button 
                      onClick={() => handleSyncWooCommerce(channel)}
                      disabled={isSyncing[channel.id] || isSyncingAll}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing[channel.id] ? 'animate-spin' : ''}`} />
                      {isSyncing[channel.id] ? 'جاري السحب...' : 'سحب الطلبيات'}
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedChannelId(channel.id)}
                    className="px-3 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 py-2 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                    title="تعديل القناة واللوقو"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                  <button 
                    onClick={() => handleInitiateDeleteChannel(channel)}
                    className="px-3 bg-red-50 text-red-600 hover:bg-red-100 py-2 rounded-lg text-[11px] transition-colors"
                    title="حذف القناة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {salesChannels.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
            <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold mb-1">لا توجد قنوات بيع</p>
            <p className="text-xs text-gray-400">قم بإضافة متجرك لاستيراد الطلبيات بسهولة</p>
          </div>
        )}
      </div>

      {/* Modal: Confirm Delete Channel */}
      {channelToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">تأكيد حذف قناة البيع</h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">عملية غير قابلة للتراجع</p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 text-xs font-bold text-rose-900 space-y-2 leading-relaxed">
              <p>هل أنت متأكد من حذف متجر / قناة البيع التالية؟</p>
              <div className="bg-white/90 p-3 rounded-xl border border-rose-100 text-slate-800 font-normal space-y-1 text-xs">
                <div><strong>الاسم:</strong> {channelToDelete.name}</div>
                <div><strong>النوع:</strong> {channelToDelete.type}</div>
                <div><strong>الرابط:</strong> {channelToDelete.config?.storeUrl || '-'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                disabled={isDeletingChannel}
                onClick={handleConfirmDeleteChannel}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingChannel ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                تأكيد الحذف
              </button>
              <button
                disabled={isDeletingChannel}
                onClick={() => setChannelToDelete(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Integrity Safeguard Modal */}
      <IntegrityProtectionModal
        isOpen={showIntegrityModal}
        onClose={() => {
          setShowIntegrityModal(false);
          setBlockedChannel(null);
        }}
        result={integrityBlockResult}
        safeActionLabel="تعطيل القناة بدلاً من الحذف"
        onConfirmSafeAction={handleSafeDeactivateChannel}
      />

      {isAddingChannel && (
        <AddChannelModal 
          onClose={() => setIsAddingChannel(false)} 
        />
      )}
      
      {selectedChannelId && (
        <EditChannelModal 
          channel={salesChannels.find(c => c.id === selectedChannelId)!} 
          onClose={() => setSelectedChannelId(null)} 
        />
      )}
    </div>
  );
}

function AddChannelModal({ onClose }: { onClose: () => void }) {
  const { addSalesChannel } = useStore();
  const [type, setType] = useState<SalesChannel['type']>('custom');
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const newChannel: SalesChannel = {
      id: Date.now().toString(),
      name: name || (type === 'custom' ? 'قناة شركة توصيل' : type === 'woocommerce' ? 'متجر WooCommerce' : 'متجر إلكتروني'),
      type,
      isActive: true,
      logoUrl: logoUrl.trim() || undefined,
      config: type === 'woocommerce' ? {
        storeUrl,
        consumerKey,
        consumerSecret
      } : {}
    };
    await addSalesChannel(newChannel);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-black text-gray-800 text-sm">إضافة قناة بيع جديدة</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">نوع المنصة / القناة</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value as any)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500"
            >
              <option value="custom">شركة توصيل / قناة يدوية مخصصة</option>
              <option value="woocommerce">WooCommerce (ربط تلقائي)</option>
              <option value="shopify">Shopify</option>
              <option value="sheets">Google Sheets</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">اسم القناة</label>
            <input
              type="text"
              placeholder={type === 'custom' ? 'مثال: شركة التوصيل (Yalidine)...' : 'مثال: المتجر الرئيسي...'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-bold"
            />
          </div>

          {/* Logo / Icon Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Image className="w-4 h-4 text-blue-600" />
                لوقو أو أيقونة القناة (اختياري)
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="text-[10px] font-bold text-rose-600 hover:underline"
                >
                  إزالة اللوقو
                </button>
              )}
            </div>

            {/* Preview Badge */}
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500">المعاينة في الطلبيات:</span>
              <SourceChannelBadge 
                order={{ sourceChannel: name || 'اسم القناة' }} 
                configuredSalesChannels={[{ id: 'preview', name: name || 'اسم القناة', type, isActive: true, logoUrl, config: {} }]} 
              />
            </div>

            {/* Quick Presets */}
            <div>
              <span className="block text-[10px] font-bold text-slate-500 mb-1.5">أيقونات لوقو جاهزة:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_LOGOS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setLogoUrl(item.url)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                      logoUrl === item.url ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <img src={item.url} alt={item.name} className="w-3.5 h-3.5 object-contain" />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload or URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>رفع صورة من الجهاز</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>

              <input
                type="text"
                dir="ltr"
                placeholder="أو ضع رابط صورة URL..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs text-left focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {type === 'woocommerce' && (
            <>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800 leading-relaxed">
                لربط متجرك، اذهب إلى <b>WooCommerce &gt; الإعدادات &gt; متقدم &gt; مفاتيح واجهة برمجة التطبيقات API</b>، قم بإنشاء مفتاح بصلاحية <b>القراءة</b> وانسخ البيانات.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">رابط المتجر</label>
                <input
                  dir="ltr"
                  type="url"
                  placeholder="https://example.com"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-left font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">مفتاح المستهلك (Consumer Key)</label>
                <input
                  dir="ltr"
                  type="text"
                  placeholder="ck_xxxxx..."
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">سر المستهلك (Consumer Secret)</label>
                <input
                  dir="ltr"
                  type="password"
                  placeholder="cs_xxxxx..."
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono text-left"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (type === 'woocommerce' ? (!storeUrl || !consumerKey || !consumerSecret) : !name.trim())}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ وإضافة'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditChannelModal({ channel, onClose }: { channel: SalesChannel, onClose: () => void }) {
  const { updateSalesChannel } = useStore();
  const [name, setName] = useState(channel.name);
  const [logoUrl, setLogoUrl] = useState(channel.logoUrl || channel.config?.logoUrl || '');
  const [storeUrl, setStoreUrl] = useState(channel.config.storeUrl || '');
  const [consumerKey, setConsumerKey] = useState(channel.config.consumerKey || '');
  const [consumerSecret, setConsumerSecret] = useState(channel.config.consumerSecret || '');

  const [isSaving, setIsSaving] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateSalesChannel(channel.id, {
      name,
      logoUrl: logoUrl.trim() || undefined,
      config: {
        ...channel.config,
        storeUrl,
        consumerKey,
        consumerSecret,
        logoUrl: logoUrl.trim() || undefined
      }
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-black text-gray-800 text-sm">تعديل القناة واللوقو</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">اسم القناة</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-bold"
            />
          </div>

          {/* Logo / Icon Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Image className="w-4 h-4 text-blue-600" />
                لوقو أو أيقونة القناة (اختياري)
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="text-[10px] font-bold text-rose-600 hover:underline"
                >
                  إزالة اللوقو
                </button>
              )}
            </div>

            {/* Preview Badge */}
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500">المعاينة في الطلبيات:</span>
              <SourceChannelBadge 
                order={{ sourceChannel: name || 'اسم القناة' }} 
                configuredSalesChannels={[{ id: channel.id, name: name || 'اسم القناة', type: channel.type, isActive: true, logoUrl, config: {} }]} 
              />
            </div>

            {/* Quick Presets */}
            <div>
              <span className="block text-[10px] font-bold text-slate-500 mb-1.5">أيقونات لوقو جاهزة:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_LOGOS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setLogoUrl(item.url)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                      logoUrl === item.url ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <img src={item.url} alt={item.name} className="w-3.5 h-3.5 object-contain" />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload or URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors shadow-2xs">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>رفع صورة من الجهاز</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>

              <input
                type="text"
                dir="ltr"
                placeholder="أو ضع رابط صورة URL..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs text-left focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {channel.type === 'woocommerce' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">رابط المتجر</label>
                <input
                  dir="ltr"
                  type="url"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-left font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">مفتاح المستهلك (Consumer Key)</label>
                <input
                  dir="ltr"
                  type="text"
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">سر المستهلك (Consumer Secret)</label>
                <input
                  dir="ltr"
                  type="password"
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono text-left"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (channel.type === 'woocommerce' ? (!storeUrl || !consumerKey || !consumerSecret) : !name.trim())}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </div>
  );
}
