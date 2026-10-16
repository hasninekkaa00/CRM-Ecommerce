import React from 'react';
import { getProductDisplayPrice, getProductDisplayCost, getProductCostValue } from './productCostUtils';

/**
 * Check if an order matches a given product filter.
 * When a Main Product is selected (e.g. 'P::...' or product SKU/ID/Name), ALL its variations/types/offers MUST be included.
 */
export const checkProductMatch = (
  orderSkuOrOrder: string | any | undefined,
  productFilter: string | undefined,
  inventoryProducts: any[] = []
): boolean => {
  if (!productFilter || productFilter === 'all') return true;

  // Extract order SKU and other identifiers if order object is passed
  let orderSku = '';
  let orderProductName = '';
  let orderVariationName = '';
  let orderItems: any[] = [];

  if (typeof orderSkuOrOrder === 'object' && orderSkuOrOrder !== null) {
    orderSku = String(orderSkuOrOrder.sku || '');
    orderProductName = String(orderSkuOrOrder.productName || '');
    orderVariationName = String(orderSkuOrOrder.variation || '');
    // Extract items gracefully, handling WooCommerce line_items etc.
    let rawItems = orderSkuOrOrder.items || orderSkuOrOrder.line_items || orderSkuOrOrder.products || orderSkuOrOrder.cart || orderSkuOrOrder.orderedItems;
    if (typeof rawItems === 'string') {
       try { rawItems = JSON.parse(rawItems); } catch {}
    }
    if (Array.isArray(rawItems)) {
      orderItems = rawItems;
    }
  } else {
    orderSku = String(orderSkuOrOrder || '');
  }

  if (!orderSku && !orderProductName && orderItems.length === 0) return false;

  const currentSkus = orderSku
    ? orderSku.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const norm = (str: any) => String(str || '').trim().toLowerCase();

  // Also extract SKUs from order items if any
  orderItems.forEach((item: any) => {
    if (item.sku) currentSkus.push(norm(item.sku));
    if (item.variation_sku) currentSkus.push(norm(item.variation_sku));
    if (item.product_id) currentSkus.push(norm(item.product_id));
    if (item.variation_id) currentSkus.push(norm(item.variation_id));
  });

  let filterKey = productFilter.trim();
  let filterType: 'main' | 'variation' | 'category' | 'auto' = 'auto';

  if (filterKey.startsWith('P::')) {
    filterKey = filterKey.substring(3).trim();
    filterType = 'main';
  } else if (filterKey.startsWith('V::')) {
    filterKey = filterKey.substring(3).trim();
    filterType = 'variation';
  } else if (filterKey.startsWith('C::')) {
    filterKey = filterKey.substring(3).trim();
    filterType = 'category';
  }

  const normFilterKey = norm(filterKey);

  if (filterType === 'category') {
    const matchedProducts = inventoryProducts.filter(p => norm(p.category) === normFilterKey);
    const validSkus = new Set<string>();
    const validNames = new Set<string>();
    matchedProducts.forEach(p => {
       if (p.sku) validSkus.add(norm(p.sku));
       if (p.id) validSkus.add(norm(p.id));
       if (p.name) validNames.add(norm(p.name));
       if (Array.isArray(p.variations)) {
          p.variations.forEach((v: any) => {
             if (v.sku) validSkus.add(norm(v.sku));
             if (v.id) validSkus.add(norm(v.id));
          });
       }
    });
    if (currentSkus.some(s => validSkus.has(s))) return true;
    if (orderProductName) {
      const orderNames = orderProductName.split('+').map((s: string) => norm(s));
      for (const on of orderNames) {
         for (const vn of validNames) {
            if (on.includes(vn) || vn.includes(on)) return true;
         }
      }
    }
    return false;
  }

  // If specific variation filter is chosen
  if (filterType === 'variation') {
    if (currentSkus.includes(normFilterKey)) return true;
    if (norm(orderVariationName) === normFilterKey) return true;
    return false;
  }

  // Find the product in inventory: match by sku, id, name, slug or variations
  const mainProduct = inventoryProducts.find((p: any) => {
    if (norm(p.sku) === normFilterKey) return true;
    if (norm(p.id) === normFilterKey) return true;
    if (norm(p.name) === normFilterKey) return true;
    if (p.slug && norm(p.slug) === normFilterKey) return true;
    // If filterKey is a variation of this product
    if (p.variations?.some((v: any) => norm(v.sku) === normFilterKey || norm(v.id) === normFilterKey || norm(v.name) === normFilterKey)) {
      return true;
    }
    return false;
  });

  if (mainProduct) {
    const validSkus = new Set<string>();
    if (mainProduct.sku) validSkus.add(norm(mainProduct.sku));
    if (mainProduct.id) validSkus.add(norm(mainProduct.id));

    // ALWAYS include all variations when main product is selected!
    if (Array.isArray(mainProduct.variations)) {
      mainProduct.variations.forEach((v: any) => {
        if (v.sku) validSkus.add(norm(v.sku));
        if (v.id) validSkus.add(norm(v.id));
      });
    }

    // Check if order contains any valid SKU
    if (currentSkus.some(s => validSkus.has(s))) return true;

    // Check if product name matches (including combo product names like 'A + B')
    if (orderProductName) {
      const orderNames = orderProductName.split('+').map((s: string) => norm(s));
      if (orderNames.some((n: string) => n.includes(norm(mainProduct.name)) || norm(mainProduct.name).includes(n))) {
        return true;
      }
    }

    // Also check item names/skus
    if (orderItems.some((it: any) => {
        if (it.sku && validSkus.has(norm(it.sku))) return true;
        if (it.variation_sku && validSkus.has(norm(it.variation_sku))) return true;
        const itName = norm(it.name || it.product_name || '');
        if (itName && (itName.includes(norm(mainProduct.name)) || norm(mainProduct.name).includes(itName))) return true;
        return false;
    })) {
      return true;
    }

    return false;
  }

  // Fallback for orphaned or uncataloged products
  if (currentSkus.includes(normFilterKey)) return true;
  if (orderProductName && norm(orderProductName).includes(normFilterKey)) return true;

  return false;
};

/**
 * Check if an ad campaign matches the selected product filter.
 */
export const isCampaignMatchedToProduct = (
  campaign: any,
  productFilter: string | undefined,
  inventoryProducts: any[] = []
): boolean => {
  if (!productFilter || productFilter === 'all') return true;
  if (!campaign) return false;

  let filterKey = productFilter.trim();
  let isMainProduct = true;

  let filterType: 'main' | 'variation' | 'category' | 'auto' = 'auto';
  if (filterKey.startsWith('P::')) {
    filterKey = filterKey.substring(3).trim();
    isMainProduct = true;
    filterType = 'main';
  } else if (filterKey.startsWith('V::')) {
    filterKey = filterKey.substring(3).trim();
    isMainProduct = false;
    filterType = 'variation';
  } else if (filterKey.startsWith('C::')) {
    filterKey = filterKey.substring(3).trim();
    filterType = 'category';
  }

  const norm = (str: any) => String(str || '').trim().toLowerCase();
  const normFilterKey = norm(filterKey);

  if (filterType === 'category') {
      const campSku = norm(campaign.productSku);
      const campName = norm(campaign.name);
      return inventoryProducts.some(p => {
          if (norm(p.category) !== normFilterKey) return false;
          if (campSku && (norm(p.sku) === campSku || norm(p.id) === campSku)) return true;
          if (p.variations?.some((v: any) => norm(v.sku) === campSku || norm(v.id) === campSku)) return true;
          if (campName && norm(p.name) && campName.includes(norm(p.name))) return true;
          return false;
      });
  }

  // Find product in inventory
  const mainProduct = inventoryProducts.find((p: any) => 
    norm(p.sku) === normFilterKey || 
    norm(p.id) === normFilterKey || 
    norm(p.name) === normFilterKey ||
    p.variations?.some((v: any) => norm(v.sku) === normFilterKey || norm(v.id) === normFilterKey)
  );

  const validIdentifiers = new Set<string>();
  validIdentifiers.add(normFilterKey);

  if (mainProduct) {
    if (mainProduct.name) validIdentifiers.add(norm(mainProduct.name));
    if (mainProduct.sku) validIdentifiers.add(norm(mainProduct.sku));
    if (mainProduct.id) validIdentifiers.add(norm(mainProduct.id));
    if (isMainProduct && Array.isArray(mainProduct.variations)) {
      mainProduct.variations.forEach((v: any) => {
        if (v.sku) validIdentifiers.add(norm(v.sku));
        if (v.id) validIdentifiers.add(norm(v.id));
        if (v.name) validIdentifiers.add(norm(v.name));
      });
    }
  }

  const campProdName = norm(campaign.productName);
  const campSku = norm(campaign.productSku);
  const campName = norm(campaign.name);
  const campLinked: string[] = (campaign.linkedProducts || []).map((s: any) => norm(s));

  if (campSku) {
      if (validIdentifiers.has(campSku)) return true;
  }

  if (campProdName) {
    if (validIdentifiers.has(campProdName)) return true;
    if (Array.from(validIdentifiers).some(k => k && (campProdName.includes(k) || k.includes(campProdName)))) return true;
  }

  if (campName) {
    if (validIdentifiers.has(campName)) return true;
    if (Array.from(validIdentifiers).some(k => k && (campName.includes(k) || k.includes(campName)))) return true;
  }

  if (campLinked.some(lp => validIdentifiers.has(lp) || Array.from(validIdentifiers).some(k => k && (lp.includes(k) || k.includes(lp))))) {
    return true;
  }

  return false;
};

export const renderProductFilterOptions = (inventoryProducts: any[], orders: any[] = []) => {
    const list: any[] = [];
    const knownSkus = new Set<string>();

    inventoryProducts.forEach((p: any) => {
        const pSku = p.sku ? String(p.sku).trim() : '';
        if (pSku) knownSkus.add(pSku.toLowerCase());
        
        p.variations?.forEach((v: any) => { 
          if (v.sku) knownSkus.add(String(v.sku).trim().toLowerCase()); 
        });

        const isOffer = p.local_is_offers !== undefined ? p.local_is_offers : (p.variations && p.variations.some((v:any) => v.attributes?.some((a:any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))));
        
        const variations = (p.variations || []).filter((v:any) => v.sku || v.id);
        const filterValueKey = p.sku || p.id || p.name;
        
        list.push({
            id: p.id,
            sku: p.sku,
            filterValue: `P::${filterValueKey}`,
            name: p.name,
            isOffer,
            variations: variations.map((v:any) => ({
                sku: v.sku || v.id,
                filterValue: `V::${v.sku || v.id}`,
                name: v.name || v.attributes?.map((a:any) => a.option).join(' ') || 'نوع'
            }))
        });
    });

    const orphanedOptions: any[] = [];
    orders.forEach((o: any) => {
       const oSku = o.sku ? String(o.sku).trim() : '';
       if (oSku && !knownSkus.has(oSku.toLowerCase()) && !orphanedOptions.find(op => op.sku === oSku)) {
           orphanedOptions.push({ 
             sku: oSku, 
             name: o.productName ? `${o.productName}${o.variation ? ` - ${o.variation}` : ''}` : `منتج (${oSku})` 
           });
       }
    });

    const jsx = list.map(p => {
        if (p.variations.length > 0) {
            return (
                <optgroup key={p.id || p.sku} label={p.name}>
                    <option value={p.filterValue}>{p.isOffer ? `${p.name} (كل العروض)` : `${p.name} (الكل / جميع الأنواع)`}</option>
                    {p.variations.map((v:any) => (
                        <option key={v.sku} value={v.filterValue}>
                            {p.name} - {v.name} ({v.sku})
                        </option>
                    ))}
                </optgroup>
            );
        } else {
            return (
                <option key={p.id || p.sku} value={p.filterValue}>
                    {p.name} {p.sku ? `(${p.sku})` : ''}
                </option>
            );
        }
    }).filter(Boolean);

    if (orphanedOptions.length > 0) {
        jsx.push(
            <optgroup key="orphaned" label="أخرى (مسجلة في الطلبيات)">
                {orphanedOptions.map(o => (
                    <option key={o.sku} value={`P::${o.sku}`}>{o.name} ({o.sku})</option>
                ))}
            </optgroup>
        );
    }

    return jsx;
};

export interface ProductProfileInfo {
  isAll: boolean;
  productKey: string;
  type: 'all' | 'product' | 'variation' | 'orphaned';
  productName: string;
  variationName?: string;
  sku?: string;
  imageUrl?: string;
  price?: string | number;
  cost?: string | number;
  stockQty?: number | null;
  manageStock?: boolean;
  variationsCount?: number;
  matchedOrdersCount?: number;
}

export const getProductProfileInfo = (
  filterKey: string,
  inventoryProducts: any[] = [],
  orders: any[] = []
): ProductProfileInfo => {
  if (!filterKey || filterKey === 'all') {
    return {
      isAll: true,
      productKey: 'all',
      type: 'all',
      productName: 'جميع المنتجات والعمليات',
      variationsCount: inventoryProducts.length,
      matchedOrdersCount: orders.length
    };
  }

  let sku = filterKey;
  let type: 'product' | 'variation' | 'orphaned' = 'product';

  if (filterKey.startsWith('P::')) {
    sku = filterKey.substring(3);
    type = 'product';
  } else if (filterKey.startsWith('V::')) {
    sku = filterKey.substring(3);
    type = 'variation';
  }

  let foundProduct: any = null;
  let foundVariation: any = null;

  for (const p of inventoryProducts) {
    if (type === 'product' && (p.sku === sku || String(p.id) === sku || p.name === sku)) {
      foundProduct = p;
      break;
    }
    if (type === 'variation') {
      const v = p.variations?.find((varItem: any) => varItem.sku === sku || String(varItem.id) === sku);
      if (v) {
        foundProduct = p;
        foundVariation = v;
        break;
      }
    }
    if (p.sku === sku || String(p.id) === sku || p.name === sku) {
      foundProduct = p;
      break;
    }
    const v = p.variations?.find((varItem: any) => varItem.sku === sku || String(varItem.id) === sku);
    if (v) {
      foundProduct = p;
      foundVariation = v;
      type = 'variation';
      break;
    }
  }

  const matchedOrdersCount = orders.filter(o => checkProductMatch(o, filterKey, inventoryProducts)).length;

  if (foundProduct) {
    const pImg = foundProduct.images?.[0]?.src || foundProduct.images?.[0] || (typeof foundProduct.image === 'string' ? foundProduct.image : foundProduct.image?.src);
    const vImg = foundVariation?.image?.src || (typeof foundVariation?.image === 'string' ? foundVariation.image : null);
    const imageUrl = vImg || pImg;

    if (foundVariation) {
      const varName = foundVariation.name || foundVariation.attributes?.map((a: any) => a.option).join(' ') || 'تفرع';
      const vPrice = foundVariation.price || foundVariation.regular_price || foundProduct.price;
      const vCost = getProductCostValue(foundVariation) || getProductCostValue(foundProduct);

      return {
        isAll: false,
        productKey: filterKey,
        type: 'variation',
        productName: foundProduct.name,
        variationName: varName,
        sku: foundVariation.sku || sku,
        imageUrl,
        price: vPrice ? `${vPrice} د.ج` : 'غير محدد',
        cost: vCost ? `${vCost} د.ج` : '—',
        stockQty: foundVariation.local_stock_quantity ?? foundProduct.local_stock_quantity ?? null,
        manageStock: foundVariation.local_manage_stock ?? foundProduct.local_manage_stock ?? false,
        matchedOrdersCount
      };
    } else {
      const pDisplayPrice = getProductDisplayPrice(foundProduct);
      const pDisplayCost = getProductDisplayCost(foundProduct);

      return {
        isAll: false,
        productKey: filterKey,
        type: 'product',
        productName: foundProduct.name,
        sku: foundProduct.sku || sku,
        imageUrl,
        price: pDisplayPrice,
        cost: pDisplayCost,
        stockQty: foundProduct.local_stock_quantity ?? null,
        manageStock: foundProduct.local_manage_stock ?? false,
        variationsCount: foundProduct.variations?.length || 0,
        matchedOrdersCount
      };
    }
  }

  const sampleOrder = orders.find(o => checkProductMatch(o, filterKey, inventoryProducts));
  return {
    isAll: false,
    productKey: filterKey,
    type: 'orphaned',
    productName: sampleOrder?.productName || `منتج (${sku})`,
    variationName: sampleOrder?.variation,
    sku,
    matchedOrdersCount
  };
};
