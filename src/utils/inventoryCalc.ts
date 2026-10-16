const normalizeStr = (str: any) => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');
};

const extractTokens = (str: string) => {
  return normalizeStr(str)
    .split(/[\s\-/,\.\(\)]+/)
    .filter(Boolean);
};

const matchOrderItem = (
  productName: string,
  variation: string,
  sku: string,
  item: any,
  isParent: boolean,
  parentProduct: any
) => {
  const getItemSku = () => normalizeStr(item?.sku || '');
  const getParentName = () => normalizeStr(parentProduct?.name || (isParent ? item?.name : ''));
  const getVariationName = () => normalizeStr(item?.name || item?.attributes?.map((a: any) => a.option).join(' ') || '');
  const getCombinedName = () => `${getParentName()} - ${getVariationName()}`.trim();

  const targetSku = getItemSku();
  const oSku = normalizeStr(sku);

  // Extract individual SKUs if comma/semicolon/pipe separated
  const orderSkus = oSku
    ? oSku.split(/[,;|\n]+/).map(s => normalizeStr(s)).filter(Boolean)
    : [];
  if (oSku && !orderSkus.includes(oSku)) {
    orderSkus.push(oSku);
  }

  // 1. STRICT SKU MATCHING WHEN BOTH TARGET SKU AND ORDER SKU ARE PRESENT
  if (targetSku && orderSkus.length > 0) {
    if (orderSkus.includes(targetSku)) {
      return true;
    }
    // If target is parent product, check if orderSku matches any of its variation SKUs
    if (isParent && parentProduct && Array.isArray(parentProduct.variations)) {
      const matchedVarSku = parentProduct.variations.some((v: any) => {
        const vSku = normalizeStr(v.sku);
        return vSku && orderSkus.includes(vSku);
      });
      if (matchedVarSku) return true;
    }
    // If both target SKU and order SKU exist but do NOT match -> strict false
    return false;
  }

  // 2. NAME / VARIATION MATCHING (When SKU is missing on either side)
  const pName = normalizeStr(productName);
  const vName = normalizeStr(variation);
  const parentName = getParentName();
  const varName = getVariationName();
  const combinedName = normalizeStr(getCombinedName());

  if (isParent) {
    if (!parentName) return false;
    if (pName === parentName) return true;
    if (pName && pName.includes(parentName)) return true;
    if (parentName && pName && parentName.includes(pName) && pName.length >= 3) return true;
    return false;
  } else {
    // Specific variation check
    const parentMatches =
      (pName && parentName && (pName === parentName || pName.includes(parentName) || parentName.includes(pName))) ||
      (pName && combinedName && (pName === combinedName || pName.includes(combinedName)));

    if (!parentMatches) return false;

    if (!varName) {
      return true;
    }

    if (vName && vName === varName) return true;

    const varTokensSorted = extractTokens(varName).sort().join(' ');
    const orderVarTokensSorted = extractTokens(vName).sort().join(' ');

    if (varTokensSorted && orderVarTokensSorted) {
      if (varTokensSorted === orderVarTokensSorted) {
        return true;
      }
      return false;
    }

    if (!vName && pName) {
      if (pName === combinedName) return true;
      const pNameTokensSorted = extractTokens(pName).sort().join(' ');
      const combinedTokensSorted = extractTokens(combinedName).sort().join(' ');
      if (pNameTokensSorted && combinedTokensSorted && pNameTokensSorted === combinedTokensSorted) {
        return true;
      }
    }

    return false;
  }
};

const getSafeQty = (qval: any) => {
  if (!qval) return 1;
  const digits = String(qval).match(/\d+/);
  const parsed = digits ? parseInt(digits[0], 10) : 1;
  return isNaN(parsed) ? 1 : parsed;
};

export const calculateDynamicStock = (
  item: any,
  isParent: boolean,
  parentProduct: any,
  purchaseInvoices: any[],
  orders: any[]
) => {
  const vars = item?.variations || (isParent ? parentProduct?.variations : []);
  const hasVars = isParent && Array.isArray(vars) && vars.length > 0;
  if (hasVars) {
    const isOfferFallback = vars.some((v: any) =>
      v.attributes?.some((a: any) => a.option && (a.option.includes('عرض') || a.option.includes('pack') || a.option.includes('كمية')))
    );
    const isOffer = item.local_is_offers !== undefined ? item.local_is_offers : isOfferFallback;
    if (!isOffer) {
      return vars.reduce((sum: number, v: any) => {
        return sum + calculateDynamicStock(v, false, item, purchaseInvoices, orders);
      }, 0);
    }
  }

  let purchased = Number(item.local_stock_quantity ?? item.stock_quantity ?? item.quantity ?? 0);
  return purchased;
};

export const calculateReturnedStock = (
  item: any,
  isParent: boolean,
  parentProduct: any,
  orders: any[]
) => {
  const vars = item?.variations || (isParent ? parentProduct?.variations : []);
  const hasVars = isParent && Array.isArray(vars) && vars.length > 0;
  if (hasVars) {
    const isOfferFallback = vars.some((v: any) =>
      v.attributes?.some((a: any) => a.option && (a.option.includes('عرض') || a.option.includes('pack') || a.option.includes('كمية')))
    );
    const isOffer = item.local_is_offers !== undefined ? item.local_is_offers : isOfferFallback;
    if (!isOffer) {
      return vars.reduce((acc: { pendingQty: number; restockedQty: number }, v: any) => {
        const res = calculateReturnedStock(v, false, item, orders);
        return {
          pendingQty: acc.pendingQty + res.pendingQty,
          restockedQty: 0
        };
      }, { pendingQty: 0, restockedQty: 0 });
    }
  }

  let pendingQty = 0;

  if (orders && Array.isArray(orders)) {
    orders.forEach(o => {
      const s1 = (o.status1 || '').trim().toLowerCase();
      const s2 = (o.status2 || '').trim().toLowerCase();
      
      const isReturned = s2 === 'مرتجع' || s1 === 'مرتجع';

      if (isReturned && !o.stockRestocked) {
         const mainQty = getSafeQty(o.qnts);
         let itemQtyTotal = 0;

         if (o.items && Array.isArray(o.items) && o.items.length > 0) {
           o.items.forEach((it: any) => {
             const itName = it.name || it.productName || o.productName || '';
             const itVar = it.variation || (o.items.length === 1 ? o.variation : '') || '';
             const itSku = it.sku || o.sku || '';
             const itQty = getSafeQty(it.quantity ?? it.qnts);
             if (matchOrderItem(itName, itVar, itSku, item, isParent, parentProduct)) {
               itemQtyTotal += itQty;
             }
           });
         } else {
           if (matchOrderItem(o.productName, o.variation, o.sku, item, isParent, parentProduct)) {
             itemQtyTotal += mainQty;
           }
         }

         pendingQty += itemQtyTotal;
      }
    });
  }

  return { pendingQty, restockedQty: 0 };
};

export const calculateShippedStock = (
  item: any,
  isParent: boolean,
  parentProduct: any,
  orders: any[]
): number => {
  const vars = item?.variations || (isParent ? parentProduct?.variations : []);
  const hasVars = isParent && Array.isArray(vars) && vars.length > 0;
  if (hasVars) {
    const isOfferFallback = vars.some((v: any) =>
      v.attributes?.some((a: any) => a.option && (a.option.includes('عرض') || a.option.includes('pack') || a.option.includes('كمية')))
    );
    const isOffer = item.local_is_offers !== undefined ? item.local_is_offers : isOfferFallback;
    if (!isOffer) {
      return vars.reduce((sum: number, v: any) => {
        return sum + calculateShippedStock(v, false, item, orders);
      }, 0);
    }
  }

  let shippedQty = 0;

  if (orders && Array.isArray(orders)) {
    orders.forEach(o => {
      if (o.archived || o.trashed) return;
      const s1 = (o.status1 || '').trim().toLowerCase();
      const s2 = (o.status2 || '').trim().toLowerCase();
      
      const isShipped = s2 === 'تم الشحن' || s1 === 'تم الشحن';

      if (isShipped) {
         const mainQty = getSafeQty(o.qnts);
         let itemQtyTotal = 0;

         if (o.items && Array.isArray(o.items) && o.items.length > 0) {
           o.items.forEach((it: any) => {
             const itName = it.name || it.productName || o.productName || '';
             const itVar = it.variation || (o.items.length === 1 ? o.variation : '') || '';
             const itSku = it.sku || o.sku || '';
             const itQty = getSafeQty(it.quantity ?? it.qnts);
             if (matchOrderItem(itName, itVar, itSku, item, isParent, parentProduct)) {
               itemQtyTotal += itQty;
             }
           });
         } else {
           if (matchOrderItem(o.productName, o.variation, o.sku, item, isParent, parentProduct)) {
             itemQtyTotal += mainQty;
           }
         }

         shippedQty += itemQtyTotal;
      }
    });
  }

  return shippedQty;
};
