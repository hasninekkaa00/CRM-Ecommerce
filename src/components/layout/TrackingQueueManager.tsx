import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Play, Pause, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAttemptCount } from '../../utils/orderUtils';
import { playActionSound } from '../../utils/audioUtils';
import { fetchUniversalTrackingInfo } from '../../utils/universalShippingApi';
import { getIsQuotaExceeded } from '../../lib/firebase';

const translateActivityStatus = (status: string) => {
  if (!status) return '';
  const lowerStatus = String(status).toLowerCase().trim().replace(/[\s_-]+/g, '');
  const map: Record<string, string> = {
    'orderinformationreceivedbycarrier': 'جاهزة للإرسال',
    'created': 'جاهزة للإرسال',
    'prêtàexpédier': 'جاهزة للإرسال',
    'pretaexpedier': 'جاهزة للإرسال',
    'prêt': 'جاهزة للإرسال',
    'pret': 'جاهزة للإرسال',
    'coliscréé': 'جاهزة للإرسال',
    'coliscree': 'جاهزة للإرسال',
    'enregistré': 'جاهزة للإرسال',
    'enregistre': 'جاهزة للإرسال',
    'demanded\'enlèvement': 'جاهزة للإرسال',
    'demanded\'expedition': 'جاهزة للإرسال',
    'picked': 'تم استلام الطلبية',
    'acceptedbycarrier': 'مستلمة في مركز الفرز (Hub)',
    'dispatchedtodriver': 'قيد التوصيل (موزعة للمندوب)',
    'attemptdelivery': 'محاولة توصيل',
    'returnasked': 'طلب إرجاع',
    'returnintransit': 'مرتجع في الطريق',
    'returnreceived': 'تم استقبال المرتجع',
    'livred': 'تم التوصيل',
    'livré': 'تم التوصيل',
    'livre': 'تم التوصيل',
    'delivered': 'تم التوصيل',
    'encaissed': 'تم تحصيل المبلغ',
    'encaissé': 'تم تحصيل المبلغ',
    'encaisse': 'تم تحصيل المبلغ',
    'payed': 'تم الدفع للمتجر',
    'payé': 'تم الدفع للمتجر',
    'paye': 'تم الدفع للمتجر',
    'paid': 'تم الدفع للمتجر',
    'retour': 'مرتجع',
    'retourné': 'مرتجع',
    'returned': 'مرتجع',
    'deliveryfailed': 'فشل التوصيل',
    'canceled': 'ملغى',
    'cancelled': 'ملغى'
  };
  return map[lowerStatus] || status;
};

export function TrackingQueueManager() {
  const {
    orders,
    updateOrder,
    settings,
    trackingQueue,
    trackingQueueTotal,
    isTrackingQueueProcessing,
    setTrackingQueueState,
    clearTrackingQueue
  } = useStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const currentProcessingId = useStore(state => state.currentTrackingProcessingId);

  const isLoopRunningRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);

  useEffect(() => {
    consecutiveErrorsRef.current = consecutiveErrors;
  }, [consecutiveErrors]);

  const mapStatusToStatus2 = (statusText: string, order?: any) => {
    let s = (statusText || '').toLowerCase().trim();
    
    const isGeneric = s === 'تم الشحن' || s === '' || s === 'shipped';
    if (order && isGeneric) {
      const history = order.trackingHistory || [];
      if (history.length > 0) {
         const lastStatus = (history[history.length - 1].status || '').toLowerCase().trim();
         if (lastStatus && !lastStatus.includes('تم الشحن')) {
            s = lastStatus;
         }
      } else if (order.notes) {
         const lastNoteLine = order.notes.split('\n').pop();
         if (lastNoteLine && lastNoteLine.includes('[حالة الشحن]:')) {
             const extracted = lastNoteLine.split('[حالة الشحن]:')[1].split('-')[0].trim().toLowerCase();
             if (extracted) s = extracted;
         }
      }
    }

    if (!s) return 'تم الشحن';

    // 1. Ready / Created / Ready to Ship (جاهزة للإرسال / prêt à expédier / crééd) -> تم الشحن
    if (
      s.includes('prêt') || s.includes('pret') || s.includes('ready') ||
      s.includes('جاهزة للإرسال') || s.includes('جاهزة لارسال') || s.includes('جاهز للإرسال') || s.includes('جاهز لارسال') ||
      s.includes('جاهزة للشحن') || s.includes('جاهز للشحن') || s.includes('قابلة للشحن') ||
      s.includes('انشاء') || s.includes('أنشئ') || s.includes('تسجيل') || s.includes('créé') || s.includes('cree') || s.includes('created') ||
      s.includes('enregistré') || s.includes('enregistre') || s.includes('orderinformationreceivedbycarrier') || s.includes('demande') ||
      s.includes('تم استقبال الطلبية من طرف شركة التوصيل') || s.includes('تم تسجيل الطلبية')
    ) {
      return 'تم الشحن';
    }

    // 2. Explicit Delivered / Received -> مستلم
    if (
      s.includes('تم التوصيل') || s.includes('تم تحصيل المبلغ') || s.includes('تم الدفع للمتجر') || 
      s.includes('livred') || s.includes('encaissed') || s.includes('payed') || s.includes('paid') ||
      s.includes('livré') || s.includes('livre') || s.includes('delivered') || 
      (s.includes('توصيل') && !s.includes('محاولة') && !s.includes('شركة التوصيل') && !s.includes('قيد') && !s.includes('رسوم') && !s.includes('إلى') && !s.includes('مركز')) ||
      (s.includes('مستلم') && !s.includes('مركز الفرز') && !s.includes('استلام') && !s.includes('شركة'))
    ) {
      return 'مستلم';
    }

    // 3. Explicit Returned -> مرتجع
    if (
      s.includes('مرتجع') || s.includes('طلب إرجاع') || s.includes('فشل') || s.includes('إرجاع') || s.includes('مسترجع') ||
      s.includes('return') || s.includes('returned') || s.includes('retour') || s.includes('échoué') || 
      s.includes('annul') || s.includes('echec') || s.includes('echoue') || s.includes('echoué') || s.includes('canceled') || s.includes('cancelled')
    ) {
      return 'مرتجع';
    }

    // 4. In Transit / Sorting Center / Out for Delivery -> في الطريق
    if (
      s.includes('محاولة توصيل') || s.includes('قيد التوصيل') || s.includes('قيد التوزيع') || s.includes('محاولة') ||
      s.includes('مركز الفرز') || s.includes('الفرز') || s.includes('موزعة للمندوب') || s.includes('في الطريق') ||
      s.includes('sortie') || s.includes('distribution') || s.includes('hub') || s.includes('centre de tri') || s.includes('transit') ||
      s.includes('cours') || s.includes('vers') || s.includes('route') || s.includes('توجيه') || s.includes('dispatch') ||
      s.includes('sorti') || s.includes('transfert') || s.includes('transfer') || s.includes('voyage') || s.includes('en voyage') ||
      ((s.includes('expedie') || s.includes('expédié') || s.includes('expédition') || s.includes('expedition')) && !s.includes('prêt') && !s.includes('pret') && !s.includes('جاهز'))
    ) {
      return 'في الطريق';
    }

    if (order && getAttemptCount(order) > 0) {
      return 'في الطريق';
    }

    return 'تم الشحن';
  };

  const getCleanRemark = (r: any) => {
    if (!r) return '';
    let clean = r.toString().trim().toLowerCase();
    clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean === 'ecrire une remarque' || clean === 'أكتب ملاحظة') return '';
    return r.toString().trim();
  };

  // The sequential process worker
  useEffect(() => {
    let active = true;

    if (!isTrackingQueueProcessing) {
      isLoopRunningRef.current = false;
      useStore.getState().setTrackingQueueState({ currentTrackingProcessingId: null });
      return;
    }

    const runLoop = async () => {
      isLoopRunningRef.current = true;

      while (active) {
        const state = useStore.getState();
        const currentQueue = state.trackingQueue;
        const processingActive = state.isTrackingQueueProcessing;

        if (currentQueue.length === 0 || !processingActive) {
          if (currentQueue.length === 0 && processingActive) {
            useStore.getState().setTrackingQueueState({ isTrackingQueueProcessing: false, trackingQueueTotal: 0 });
          }
          useStore.getState().setTrackingQueueState({ currentTrackingProcessingId: null });
          break;
        }

        if (getIsQuotaExceeded()) {
          useStore.getState().setTrackingQueueState({ isTrackingQueueProcessing: false });
          useStore.getState().setTrackingQueueState({ currentTrackingProcessingId: null });
          toast('تم إيقاف المزامنة التلقائية مؤقتاً لتجاوز حصة الكتابة اليومية للفايربيس.', { id: 'quota-queue-pause', icon: 'ℹ️' });
          break;
        }

        // Check for consecutive error safety
        if (consecutiveErrorsRef.current >= 4) {
          toast.error('تم إيقاف تحديث الخلفية مؤقتاً لتجنب حظر سيرفر شركة الشحن بسبب أخطاء متتالية.', { id: 'queue-err-stop' });
          useStore.getState().setTrackingQueueState({ isTrackingQueueProcessing: false });
          useStore.getState().setTrackingQueueState({ currentTrackingProcessingId: null });
          break;
        }

        const nextId = currentQueue[0];
        useStore.getState().setTrackingQueueState({ currentTrackingProcessingId: nextId });

        const freshOrders = state.orders;
        const freshSettings = state.settings;

        const order = freshOrders.find(o => o.id === nextId);
        if (!order || !order.shippingTrackingId || order.shippingTrackingId === 'تسليم يدوي') {
          // Skip invalid order
          if (!active) break;
          const latestQueue = useStore.getState().trackingQueue;
          useStore.getState().setTrackingQueueState({ trackingQueue: latestQueue.slice(1) });
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        const integration = freshSettings?.shippingIntegrations?.find(i => i.name === order.deliveryCompany && i.isActive)
                         || freshSettings?.shippingIntegrations?.find(i => i.isActive);
        if (!integration || !integration.token) {
          // Skip since integration is missing
          if (!active) break;
          const latestQueue = useStore.getState().trackingQueue;
          useStore.getState().setTrackingQueueState({ trackingQueue: latestQueue.slice(1) });
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        try {
          // 1. Fetch tracking status using universal shipping API
          const data = await fetchUniversalTrackingInfo(order.shippingTrackingId, integration);

          if (!data.success) {
            const isDown = (data as any)?.isUnavailable || 
                           data.message?.toLowerCase().includes('service unavailable') || 
                           data.message?.includes('503') || 
                           data.message?.includes('502') || 
                           data.message?.includes('504');
            const isRateLimit = (data as any)?.isRateLimited || data.message?.includes('429');

            if (isDown) {
              console.warn(`[TrackingQueue] خادم شركة التوصيل غير متاح مؤقتاً للطلبية ${order.id}:`, data.message);
              // Stamp lastTrackingSync to prevent immediate retry loop
              try {
                await state.updateOrder(order.id, { lastTrackingSync: new Date().toISOString(), lastSyncType: "auto" }, true);
              } catch {}
              toast('خادم شركة التوصيل غير متاح مؤقتاً (Service Unavailable). تم إيقاف التحديث التلقائي مؤقتاً لحين عودة الخدمة.', {
                id: 'queue-server-down',
                icon: '⏳'
              });
              useStore.getState().setTrackingQueueState({ isTrackingQueueProcessing: false, currentTrackingProcessingId: null });
              break;
            }

            if (isRateLimit) {
              console.warn(`[TrackingQueue] تم بلوغ حد الطلبات لشركة التوصيل للطلبية ${order.id}:`, data.message);
              try {
                await state.updateOrder(order.id, { lastTrackingSync: new Date().toISOString(), lastSyncType: "auto" }, true);
              } catch {}
              toast('تم تجاوز حد طلبات شركة التوصيل مؤقتاً. تم إيقاف المزامنة التلقائية لتفادي الحظر.', {
                id: 'queue-server-ratelimit',
                icon: '⏸️'
              });
              useStore.getState().setTrackingQueueState({ isTrackingQueueProcessing: false, currentTrackingProcessingId: null });
              break;
            }

            // Normal skip for tracking not found or pending dispatch
            console.warn(`[TrackingQueue] تعذر استرجاع التتبع للطلبية ${order.id}:`, data.message);
            try {
              await state.updateOrder(order.id, { lastTrackingSync: new Date().toISOString(), lastSyncType: "auto" }, true);
            } catch {}
            
            if (!active) break;
            const latestQueue = useStore.getState().trackingQueue;
            useStore.getState().setTrackingQueueState({ trackingQueue: latestQueue.slice(1) });
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          let mainStatus = '';
          let remarque = '';
          let responseData = data.data;

          if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && responseData.data) {
            responseData = responseData.data;
          }

          let rawHistoryArray: any[] = [];

          if (typeof responseData === 'string') {
            try {
              const parsed = JSON.parse(responseData);
              if (typeof parsed === 'object' && parsed !== null) {
                responseData = parsed;
              } else {
                mainStatus = responseData;
              }
            } catch(e) {
              mainStatus = responseData;
            }
          }

          if (Array.isArray(responseData)) {
            rawHistoryArray = responseData;
            responseData = responseData[0] || {};
          } else if (typeof responseData === 'object' && responseData !== null) {
            rawHistoryArray = responseData.historique || responseData.history || responseData.activity || [];
          }

          if (typeof responseData === 'object' && responseData !== null && !mainStatus) {
            mainStatus = responseData.status || responseData.etat || responseData.state || responseData.statut || responseData.situation || (responseData.tracking_info && responseData.tracking_info.status) || '';
            if (Array.isArray(rawHistoryArray) && rawHistoryArray.length > 0) {
              const latest = rawHistoryArray[rawHistoryArray.length - 1];
              if (latest) {
                remarque = latest.commentaires || latest.remarque || latest.observation || latest.note || latest.comment || latest.reason || '';
                if (!remarque && latest.station && typeof latest.station === 'string') {
                  remarque = `المحطة: ${latest.station}`;
                }
                if (latest.status || latest.etat || latest.state || latest.statut) {
                  mainStatus = latest.status || latest.etat || latest.state || latest.statut || mainStatus;
                }
              }
            }
            if (!remarque) {
              remarque = responseData.commentaires || responseData.remarque || responseData.observation || responseData.note || responseData.comment || responseData.currentStation || '';
            }
          }

          remarque = getCleanRemark(remarque);

          let parsedHistory: any[] = [];
          if (Array.isArray(rawHistoryArray)) {
            parsedHistory = rawHistoryArray.map((item: any) => ({
              status: translateActivityStatus(item.status || item.etat || item.state || item.statut || item.activity || mainStatus || ''),
              remarque: getCleanRemark(item.commentaires || item.remarque || item.observation || item.note || item.comment || item.reason || ''),
              station: item.station || item.hub || '',
              livreur: item.livreur || item.driver || item.livreur_name || '',
              date: item.created_at || item.date || item.time || ''
            })).filter((item: any) => item.status || item.remarque || item.station || item.livreur);
          }

          // 2. Fetch remarks
          let appendedNotesString = "";
          try {
            const remarksRes = await fetch('/api/shipping/ecotrack/remarks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                domain: integration.domain || 'https://expedigo.ecotrack.dz',
                token: integration.token,
                trackingId: order.shippingTrackingId
              })
            });
            
            let remarksData: any = null;
            if (remarksRes.ok) {
              const rawText = await remarksRes.text();
              if (rawText && !rawText.trim().startsWith('<')) {
                try {
                  remarksData = JSON.parse(rawText);
                } catch {
                  remarksData = null;
                }
              }
            }

            let rawRemarksArray: any[] = [];
            if (remarksData && remarksData.success && Array.isArray(remarksData.data)) {
              rawRemarksArray = remarksData.data;
            } else if (remarksData && remarksData.success && Array.isArray(remarksData.data?.data)) {
              rawRemarksArray = remarksData.data.data;
            }

            if (rawRemarksArray.length > 0) {
              const newRemarks = rawRemarksArray.map((item: any) => ({
                status: 'ملاحظة',
                remarque: getCleanRemark(item.commentaires || item.remarque || ''),
                station: item.station || '',
                livreur: item.livreur || '',
                date: item.created_at || ''
              })).filter((item: any) => item.remarque || item.station || item.livreur);
              
              const existingSignatures = new Set(parsedHistory.map(h => `${h.date}-${h.remarque}`));
              const uniqueNewRemarks = newRemarks.filter(r => !existingSignatures.has(`${r.date}-${r.remarque}`));

              if (uniqueNewRemarks.length > 0) {
                parsedHistory = [...parsedHistory, ...uniqueNewRemarks];
                parsedHistory.sort((a, b) => {
                  if (!a.date) return 1;
                  if (!b.date) return -1;
                  return new Date(a.date).getTime() - new Date(b.date).getTime();
                });

                let currentNotes = order.notes || '';
                uniqueNewRemarks.forEach(ur => {
                  if (ur.remarque && !currentNotes.includes(ur.remarque)) {
                     const d = ur.date ? new Date(ur.date) : new Date();
                     const y = d.getFullYear();
                     const m = String(d.getMonth() + 1).padStart(2, '0');
                     const day = String(d.getDate()).padStart(2, '0');
                     let h = d.getHours();
                     const min = String(d.getMinutes()).padStart(2, '0');
                     const ampm = h >= 12 ? 'م' : 'ص';
                     h = h % 12 || 12;
                     const fH = String(h).padStart(2, '0');
                     const timeStamp = `[📌 ${y}/${m}/${day} - ${fH}:${min} ${ampm}]`;
                     
                     let authorHeader = '[🚚 ملاحظة الليفرور]';
                     if (ur.livreur) {
                         authorHeader = `[🚚 ${ur.livreur}]`;
                     } else if (ur.station) {
                         authorHeader = `[🏢 ${ur.station}]`;
                     }
                     const noteLine = `${timeStamp} ${authorHeader} ${ur.remarque}`;
                     
                     if (appendedNotesString) {
                         appendedNotesString = `${noteLine}\n${appendedNotesString}`;
                     } else {
                         appendedNotesString = noteLine;
                     }
                     currentNotes = `${noteLine}\n${currentNotes}`;
                  }
                });
              }
            }
          } catch (err) {
            console.warn("Could not fetch remarks in background:", err);
          }

          if (typeof mainStatus !== 'string' || mainStatus.startsWith('{')) mainStatus = '';
          if (typeof remarque !== 'string') remarque = '';
          mainStatus = translateActivityStatus(mainStatus);

          let shouldUpdate = false;
          const updates: any = {};
          
          if (appendedNotesString) {
             updates.notes = order.notes ? `${appendedNotesString}\n${order.notes}` : appendedNotesString;
             shouldUpdate = true;
          }

          const tarif = responseData.tarif ?? responseData.prix_livraison ?? responseData.shipping_price ?? responseData.delivery_fee ?? responseData.frais_livraison ?? responseData.frais_expedition ?? responseData.frais ?? responseData.livraison ?? responseData.cout_livraison;
          const amount = responseData.montant || responseData.price || responseData.total || responseData.cod_amount;

          if (tarif !== undefined && !isNaN(Number(tarif))) {
            const numTarif = Number(tarif);
            if (numTarif > 0 && Number(order.realDeliveryPrice) !== numTarif && order.shippingFeeMode !== 'manual') {
              updates.realDeliveryPrice = numTarif;
              shouldUpdate = true;
            }
          }

          if (amount !== undefined && !isNaN(Number(amount))) {
            const numAmount = Number(amount);
            if (numAmount > 0 && Number(order.totalCharge) !== numAmount) {
              updates.totalCharge = numAmount;
              shouldUpdate = true;
            }
          }

          const tempMergedOrder = {
            ...order,
            trackingHistory: parsedHistory.length > 0 ? (() => {
              const existingManualUpdates = (order.trackingHistory || []).filter((h: any) => h.status && h.status.includes('تحديث يدوي'));
              let mergedHistory = [...parsedHistory, ...existingManualUpdates];
              mergedHistory.sort((a, b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              });
              return mergedHistory;
            })() : (order.trackingHistory || [])
          };

          if (mainStatus) {
            const newStatus2 = mapStatusToStatus2(mainStatus, tempMergedOrder);
            const trackingNote = remarque ? `[حالة الشحن]: ${mainStatus} - أحدث ملاحظة: ${remarque}` : `[حالة الشحن]: ${mainStatus}`;
            
            if (newStatus2 !== order.status2) {
              updates.status2 = newStatus2;
              shouldUpdate = true;
            }
            
            const existingNote = updates.notes || order.notes || '';
            if (!existingNote.includes(trackingNote)) {
              updates.notes = existingNote ? `${existingNote}\n${trackingNote}` : trackingNote;
              shouldUpdate = true;
            }
          }

          if (parsedHistory.length > 0) {
            const existingManualUpdates = (order.trackingHistory || []).filter((h: any) => h.status && h.status.includes('تحديث يدوي'));
            let mergedHistory = [...parsedHistory, ...existingManualUpdates];
            
            mergedHistory.sort((a, b) => {
              if (!a.date) return 1;
              if (!b.date) return -1;
              return new Date(a.date).getTime() - new Date(b.date).getTime();
            });
            
            const currentHistoryString = JSON.stringify(order.trackingHistory || []);
            const newHistoryString = JSON.stringify(mergedHistory);
            if (currentHistoryString !== newHistoryString) {
              updates.trackingHistory = mergedHistory;
              shouldUpdate = true;
            }
          }

          updates.lastTrackingSync = new Date().toISOString();
          updates.lastSyncType = "auto";
          shouldUpdate = true;

          if (shouldUpdate && active) {
            await state.updateOrder(order.id, updates, true);
          }

          setConsecutiveErrors(0);
        } catch (err: any) {
          console.warn("Queue sync item skipped:", order.id, err?.message || err);
          try {
            await state.updateOrder(order.id, { lastTrackingSync: new Date().toISOString(), lastSyncType: "auto" }, true);
          } catch {}
          setConsecutiveErrors(prev => prev + 1);
        }

        // Finish this item, remove from queue
        if (!active) break;
        const latestQueue = useStore.getState().trackingQueue;
        useStore.getState().setTrackingQueueState({ trackingQueue: latestQueue.slice(1) });

        // Add a rate-limiting delay between requests (use 3500ms for safer Ecotrack APIs)
        await new Promise(resolve => setTimeout(resolve, 3500));
      }

      isLoopRunningRef.current = false;
    };

    runLoop();

    return () => {
      active = false;
      isLoopRunningRef.current = false;
    };
  }, [isTrackingQueueProcessing]);

  if (trackingQueue.length === 0) return null;

  const progress = trackingQueueTotal > 0 
    ? Math.round(((trackingQueueTotal - trackingQueue.length) / trackingQueueTotal) * 100) 
    : 0;

  const currentOrder = orders.find(o => o.id === currentProcessingId);

  return (
    <div className="fixed bottom-5 left-5 z-50 max-w-sm w-full font-sans" dir="rtl">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="bg-[#1e293b] text-white rounded-xl shadow-2xl border border-slate-700 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-800 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-indigo-400 ${isTrackingQueueProcessing ? 'animate-spin' : ''}`} />
              <span className="text-sm font-bold">تحديث الحالات الذكي (قائمة الانتظار)</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsMinimized(!isMinimized)} 
                className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
                title={isMinimized ? 'توسيع' : 'تصغير'}
              >
                {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button 
                onClick={() => {
                  clearTrackingQueue();
                  toast.success('تم إيقاف وإفراغ قائمة المزامنة.');
                }} 
                className="p-1 hover:bg-red-950 rounded transition-colors text-slate-400 hover:text-red-400"
                title="إلغاء المزامنة"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Progress Bar (Always visible) */}
          <div className="h-1 w-full bg-slate-800">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Expanded Content */}
          {!isMinimized && (
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>التقدم الإجمالي:</span>
                <span className="font-bold text-indigo-400">{progress}%</span>
              </div>

              <div className="flex justify-between items-end">
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400">حالة المعالجة:</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {isTrackingQueueProcessing ? 'جاري التحديث تدريجياً...' : 'موقوف مؤقتاً'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">المتبقي في الانتظار:</p>
                  <p className="text-lg font-black text-indigo-300">
                    {trackingQueue.length} <span className="text-xs font-normal text-slate-400">/ {trackingQueueTotal} طلبية</span>
                  </p>
                </div>
              </div>

              {/* Current order info */}
              {isTrackingQueueProcessing && currentOrder && (
                <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50 flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">جاري معالجة الآن:</p>
                    <p className="text-xs font-bold text-slate-200 truncate mt-0.5">
                      {currentOrder.fullName || 'عميل'} ({currentOrder.shippingTrackingId})
                    </p>
                    <p className="text-[10px] text-indigo-400 mt-0.5 font-medium">
                      شركة: {currentOrder.deliveryCompany || 'غير محددة'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 bg-indigo-500/10 text-indigo-400 p-1.5 rounded-full border border-indigo-500/20">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  </div>
                </div>
              )}

              {/* Warning about errors */}
              {consecutiveErrors > 0 && (
                <div className="p-2 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20 flex items-center gap-2 text-[11px] font-medium">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  <span>خطأ متتالي من سيرفر شركة الشحن ({consecutiveErrors}/3)</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex gap-2">
                {isTrackingQueueProcessing ? (
                  <button
                    onClick={() => {
                      setTrackingQueueState({ isTrackingQueueProcessing: false });
                      toast('تم إيقاف المزامنة مؤقتاً.', { icon: '⏸️' });
                    }}
                    className="flex-1 py-1.5 px-3 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold text-slate-200"
                  >
                    <Pause size={14} />
                    <span>إيقاف مؤقت</span>
                  </button>
                ) : (
                  <button
                    disabled={consecutiveErrors >= 3}
                    onClick={() => {
                      if (consecutiveErrors >= 3) {
                        setConsecutiveErrors(0);
                      }
                      setTrackingQueueState({ isTrackingQueueProcessing: true });
                      toast.success('تم استئناف المزامنة التدريجية.');
                    }}
                    className="flex-1 py-1.5 px-3 rounded bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold text-white disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Play size={14} />
                    <span>استئناف التحديث</span>
                  </button>
                )}

                {consecutiveErrors >= 3 && (
                  <button
                    onClick={() => {
                      setConsecutiveErrors(0);
                      setTrackingQueueState({ isTrackingQueueProcessing: true });
                      toast.success('تم تصفير عداد الأخطاء واستئناف التحديث.');
                    }}
                    className="py-1.5 px-3 rounded bg-amber-600 hover:bg-amber-500 transition-colors flex items-center justify-center text-xs font-bold text-white"
                  >
                    إعادة محاولة
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
