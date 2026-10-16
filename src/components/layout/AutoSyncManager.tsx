import { useEffect } from 'react';
import { useStore } from '../../store';
import toast from 'react-hot-toast';
import { universalSyncWooCommerce } from '../../utils/universalWooCommerceApi';

export function AutoSyncManager() {
  const autoSyncEnabled = useStore(state => state.settings?.autoSyncEnabled);
  const autoSyncIntervalSeconds = useStore(state => state.settings?.autoSyncIntervalSeconds);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const performAutoSync = async () => {
      const state = useStore.getState();
      const currentSettings = state.settings;
      const currentChannels = state.salesChannels;
      const currentSetSyncProgress = state.setSyncProgress;
      const currentAddOrder = state.addOrder;
      const currentAddAbandonedOrder = state.addAbandonedOrder;
      
      if (!currentSettings?.autoSyncEnabled) return;

      const wooChannels = (currentChannels || []).filter(c => c.type === 'woocommerce' && c.isActive);
      if (wooChannels.length === 0) return;

      let totalOrders = 0;
      let totalAbandoned = 0;
      
      currentSetSyncProgress({ isSyncing: true, message: 'جاري التحديث التلقائي للطلبات...', percent: 10, label: 'بدء المزامنة' });

      for (let i = 0; i < wooChannels.length; i++) {
        const channel = wooChannels[i];
        if (!channel.config?.storeUrl || !channel.config?.consumerKey || !channel.config?.consumerSecret) {
          continue;
        }

        try {
          currentSetSyncProgress({ isSyncing: true, message: `جاري سحب الطلبات من ${channel.name}...`, percent: 20 + i * (60 / wooChannels.length), label: 'سحب الطلبات' });
          
          // 1. Fetch processing orders using universal WooCommerce API
          const data = await universalSyncWooCommerce({
            storeUrl: channel.config.storeUrl,
            consumerKey: channel.config.consumerKey,
            consumerSecret: channel.config.consumerSecret,
            status: 'processing',
            channelName: channel.name
          });

          if (data.success && data.orders?.length > 0) {
            currentSetSyncProgress({ isSyncing: true, message: `حفظ ${data.orders.length} طلبية إلى المتجر...`, percent: 40 + i * (40 / wooChannels.length), label: 'حفظ الطلبات' });
            for (const order of data.orders) {
              const uniqueId = String(order.id).startsWith('WOO-') ? order.id : `WOO-${channel.id}-${order.id}`;
              const newOrder = {
                 ...order,
                 id: uniqueId,
                 orderId: String(order.orderId || order.id),
                 sourceChannel: order.sourceChannel || channel.name
              };
              await currentAddOrder(newOrder);
              totalOrders++;
            }
          }

          currentSetSyncProgress({ isSyncing: true, message: `جاري سحب السلات المتروكة من ${channel.name}...`, percent: 60 + i * (30 / wooChannels.length), label: 'سحب السلات' });
          
          // 2. Fetch Pending/On-Hold for abandoned
          const dataPending = await universalSyncWooCommerce({
            storeUrl: channel.config.storeUrl,
            consumerKey: channel.config.consumerKey,
            consumerSecret: channel.config.consumerSecret,
            status: 'pending,on-hold',
            channelName: channel.name
          });

          if (dataPending.success && dataPending.orders?.length > 0) {
            currentSetSyncProgress({ isSyncing: true, message: `حفظ ${dataPending.orders.length} سلة متروكة...`, percent: 80 + i * (15 / wooChannels.length), label: 'حفظ السلات' });
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
              await currentAddAbandonedOrder(newAbandoned);
              totalAbandoned++;
            }
          }

        } catch (error: any) {
          if (error && error.message === 'Failed to fetch') {
              console.warn(`[AutoSync] Temporary disconnect while syncing channel ${channel.name}.`);
          } else {
              console.error(`Auto-sync failed for channel ${channel.name}:`, error);
          }
        }
      }

      currentSetSyncProgress({ isSyncing: true, message: 'اكتملت المزامنة بنجاح!', percent: 100, label: 'مكتمل' });
      setTimeout(() => {
        useStore.getState().setSyncProgress(null);
      }, 2000);

      if (totalOrders > 0 || totalAbandoned > 0) {
         toast.success(`تحديث تلقائي: تم سحب ${totalOrders} طلبية و ${totalAbandoned} سلة متروكة المدة الماضية.`);
      }
    };

    const runLoop = (isInitial = false) => {
       const state = useStore.getState();
       const currentSettings = state.settings;
       const ms = (currentSettings?.autoSyncIntervalSeconds || 900) * 1000;
       
       let targetTime = Date.now() + ms;

       if (isInitial) {
           const storedStr = localStorage.getItem('__autoSyncNextTime');
           if (storedStr) {
               const storedTime = parseInt(storedStr, 10);
               if (storedTime > Date.now() && (storedTime - Date.now()) <= ms) {
                   targetTime = storedTime;
               }
           }
       }
       
       localStorage.setItem('__autoSyncNextTime', targetTime.toString());
       state.setNextSyncTime(targetTime);
       
       const timeoutMs = targetTime - Date.now();
       
       timeoutId = setTimeout(async () => {
          useStore.getState().setNextSyncTime(null);
          localStorage.removeItem('__autoSyncNextTime');
          await performAutoSync();
          runLoop(false);
       }, Math.max(100, timeoutMs));
    };

    if (autoSyncEnabled) {
       runLoop(true);
    } else {
       useStore.getState().setNextSyncTime(null);
       localStorage.removeItem('__autoSyncNextTime');
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [autoSyncEnabled, autoSyncIntervalSeconds]);

  return null;
}
