import { calculateDynamicStock, calculateReturnedStock } from './inventoryCalc';

export interface InventoryNotification {
  id: string;
  productId: string;
  productName: string;
  title: string;
  lowestQty: number;
  lowVariationNames: string[];
  totalParentReturned: number;
  isDeficit: boolean;
  isRead: boolean;
}

const READ_STORAGE_KEY = 'read_inventory_notifications_v1';

export function getReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    return new Set();
  }
}

export function markNotificationAsRead(id: string): Set<string> {
  const current = getReadNotificationIds();
  current.add(id);
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error("Failed to save read notification", e);
  }
  return current;
}

export function markNotificationAsUnread(id: string): Set<string> {
  const current = getReadNotificationIds();
  current.delete(id);
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error("Failed to save read notification", e);
  }
  return current;
}

export function markAllNotificationsAsRead(ids: string[]): Set<string> {
  const current = getReadNotificationIds();
  ids.forEach(id => current.add(id));
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error("Failed to save read notifications", e);
  }
  return current;
}

export function clearReadNotifications(): Set<string> {
  try {
    localStorage.removeItem(READ_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear read notifications", e);
  }
  return new Set();
}

export function getInventoryNotifications(
  inventoryProducts: any[],
  orders: any[],
  purchaseInvoices: any[],
  settings: any
): InventoryNotification[] {
  if (settings?.lowInventoryAlertEnabled === false) {
    return [];
  }

  const threshold = settings?.lowInventoryThreshold !== undefined ? settings.lowInventoryThreshold : 5;
  const isLocal = settings?.inventoryManagementMode === 'local' || !settings?.inventoryManagementMode;
  const readIds = getReadNotificationIds();

  const notifications: InventoryNotification[] = [];
  const currentLowProductIds = new Set<string>();

  (inventoryProducts || []).forEach((product: any) => {
    const productId = String(product.id || product.originalId || product.name);
    let hasVariations = product.variations && product.variations.length > 0;
    
    const isOfferFallback = hasVariations && product.variations.some((v:any) => 
       v.attributes?.some((a:any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))
    );
    const isOffer = product.local_is_offers !== undefined ? product.local_is_offers : isOfferFallback;

    let isLow = false;
    let lowestQty = Infinity;
    let lowVariationNames: string[] = [];
    let totalParentReturned = 0;

    if (hasVariations && !isOffer) {
      product.variations.forEach((v: any) => {
        let vManage = isLocal ? true : v.manage_stock;
        if (vManage) {
          let vQty = isLocal ? calculateDynamicStock(v, false, product, purchaseInvoices, orders) : Number(v.stock_quantity ?? v.quantity ?? 0);
          let vRet = isLocal ? calculateReturnedStock(v, false, product, orders).pendingQty : 0;
          if (vQty < lowestQty) lowestQty = vQty;
          if (vQty <= threshold) {
            isLow = true;
            const vName = v.attributes?.map((a:any) => a.option).join(' • ') || 'تفرع';
            let disp = `${vName} | المتبقي : ${vQty}`;
            if (vRet > 0) disp += ` | الروتور : ${vRet}`;
            lowVariationNames.push(disp);
          }
        }
      });
    } else {
      let pManage = isLocal ? true : product.manage_stock;
      if (pManage) {
        let pQty = isLocal ? calculateDynamicStock(product, true, product, purchaseInvoices, orders) : Number(product.stock_quantity ?? product.quantity ?? 0);
        totalParentReturned = isLocal ? calculateReturnedStock(product, true, product, orders).pendingQty : 0;
        if (pQty < lowestQty) lowestQty = pQty;
        if (pQty <= threshold) {
          isLow = true;
        }
      }
    }
    
    let manageStock = isLocal ? true : product.manage_stock;

    if (manageStock && isLow) {
      const notifId = `low_stock_${productId}`;
      currentLowProductIds.add(notifId);
      const isDeficit = lowestQty < 0;
      const title = isDeficit ? 'عجز خطير في المخزون' : 'مخزون منخفض';

      notifications.push({
        id: notifId,
        productId,
        productName: product.name,
        title,
        lowestQty,
        lowVariationNames,
        totalParentReturned,
        isDeficit,
        isRead: readIds.has(notifId)
      });
    }
  });

  return notifications;
}
