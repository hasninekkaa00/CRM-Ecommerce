import { Order, InventoryProduct } from '../types';
import { normalizeText, resolveShippingDisplayNames, findInventoryProductAndVariation, matchVariationWithinProduct } from './productCostUtils';
import { calculateOrderShippingWeight } from './weightUtils';

/**
 * Synchronizes an order's items array, line items, and product/variation/quantity properties.
 * Guarantees that:
 * 1. Single-product orders always have items[0] strictly reflecting the current product, variation, sku, and quantity.
 * 2. Multi-product orders with '+' in productName or multiple items retain their exact components.
 * 3. Stale arrays (line_items, products, cart, orderedItems) are synced to match.
 * 4. Parcel weight is recalculated.
 */
export function syncOrderItems<T extends Record<string, any>>(
  order: T,
  inventoryProducts?: InventoryProduct[]
): T & { items: any[]; line_items: any[]; products: any[]; cart: any[]; orderedItems: any[]; weight?: number; calculatedWeight?: number } {
  if (!order) return order as any;

  const qnts = Number(order.qnts ?? order.quantity ?? 1) || 1;
  const prodName = String(order.productName ?? order.name ?? '').trim();
  const variation = String(order.variation ?? order.variationName ?? '').trim();
  const sku = String(order.sku ?? '').trim();

  let rawItems = order.items || order.products || order.line_items || order.cart || order.orderedItems;
  if (typeof rawItems === 'string') {
    try {
      rawItems = JSON.parse(rawItems);
    } catch {
      rawItems = null;
    }
  }

  let finalItems: any[] = [];

  // Case 1: Order has compound productName containing '+' e.g. "منتج 1 + منتج 2"
  if (prodName.includes('+')) {
    const pNames = prodName.split('+').map(s => s.trim()).filter(Boolean);
    const vNames = variation ? variation.split('+').map(s => s.trim()) : [];
    const skus = sku ? sku.split(/[,;\+]+/).map(s => s.trim()) : [];

    finalItems = pNames.map((pn, idx) => {
      const existingItem = Array.isArray(rawItems) ? rawItems[idx] : null;
      const itQty = existingItem ? (Number(existingItem.quantity ?? existingItem.qnts) || 1) : 1;
      return {
        id: existingItem?.id || `item-${Date.now()}-${idx}`,
        productName: pn,
        name: pn,
        variation: vNames[idx] || (existingItem?.variation || ''),
        variationName: vNames[idx] || (existingItem?.variationName || ''),
        sku: skus[idx] || (existingItem?.sku || ''),
        qnts: itQty,
        quantity: itQty,
        price: existingItem?.price ?? 0,
        cost: existingItem?.cost,
        weight: existingItem?.weight
      };
    });
  }
  // Case 2: Order has existing multi-item array with multiple distinct items (items.length > 1)
  // BUT only if productName is not a simple single product name that was just manually set
  else if (Array.isArray(rawItems) && rawItems.length > 1 && (!prodName || rawItems.some(it => (it.name || it.productName) === prodName))) {
    finalItems = rawItems.map(it => {
      const itQty = Number(it.quantity ?? it.qnts ?? 1) || 1;
      return {
        ...it,
        id: it.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productName: (it.productName || it.name || '').trim(),
        name: (it.name || it.productName || '').trim(),
        variation: (it.variation || it.variationName || '').trim(),
        variationName: (it.variationName || it.variation || '').trim(),
        sku: (it.sku || '').trim(),
        qnts: itQty,
        quantity: itQty
      };
    });
  }
  // Case 3: Single product order (or order converted to single product)
  else {
    const existingFirst = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems[0] : null;
    const finalName = prodName || existingFirst?.name || existingFirst?.productName || 'منتج';
    const finalVar = variation !== undefined && variation !== '' ? variation : (existingFirst?.variation || existingFirst?.variationName || '');
    const finalSku = sku || existingFirst?.sku || '';

    finalItems = [{
      id: existingFirst?.id || `item-${Date.now()}`,
      productName: finalName,
      name: finalName,
      variation: finalVar,
      variationName: finalVar,
      sku: finalSku,
      qnts: qnts,
      quantity: qnts,
      price: existingFirst?.price ?? (order.priceWithoutDelivery ? Number(order.priceWithoutDelivery) / (qnts || 1) : 0),
      cost: existingFirst?.cost,
      weight: existingFirst?.weight ?? order.weight
    }];
  }

  // Recalculate parcel shipping weight for the synchronized order
  let calculatedWeight = order.calculatedWeight ?? order.weight;
  try {
    calculatedWeight = calculateOrderShippingWeight(
      { ...order, items: finalItems },
      inventoryProducts
    );
  } catch (e) {}

  return {
    ...order,
    items: finalItems,
    line_items: finalItems,
    products: finalItems,
    cart: finalItems,
    orderedItems: finalItems,
    weight: calculatedWeight,
    calculatedWeight
  };
}

/**
 * Prepares an order for shipping dispatch:
 * 1. Strictly synchronizes items array with root product and quantity fields.
 * 2. Applies the 3-tier shipping alias hierarchy to both the order and all inner items.
 * 3. Ensures correct parcel weight in kilograms.
 */
export function prepareOrderForShipping(order: any, inventoryProducts?: InventoryProduct[], customWeight?: number): any {
  if (!order) return order;

  // 1. Strictly synchronize items array
  const synced = syncOrderItems(order, inventoryProducts);
  const shippingOrder = { ...synced };

  // 2. Resolve Shipping Alias according to user's 3-tier hierarchy:
  // - Variation alias if written ("الاسم المستعار المدون")
  // - Or general product alias + variation if variation alias is empty ("الاسم العام مع زيادة النوع")
  // - Or original product name + variation if both empty ("إذا تركت فارغة يتم أخذ الاسم الأصلي")
  if (inventoryProducts && Array.isArray(inventoryProducts) && inventoryProducts.length > 0) {
    const resolved = resolveShippingDisplayNames(shippingOrder, inventoryProducts);
    shippingOrder.productName = resolved.productName;
    shippingOrder.variation = resolved.variation;

    // Apply aliases to all items in items array with their exact quantities
    if (shippingOrder.items && Array.isArray(shippingOrder.items) && shippingOrder.items.length > 0) {
      shippingOrder.items = shippingOrder.items.map((it: any) => {
        const itResolved = resolveShippingDisplayNames(
          { productName: it.name || it.productName, variation: it.variation || it.variationName, sku: it.sku },
          inventoryProducts
        );
        return {
          ...it,
          name: itResolved.productName,
          productName: itResolved.productName,
          variation: itResolved.variation,
          variationName: itResolved.variation
        };
      });
    }
  }

  // 3. Resolve shipping parcel weight
  if (customWeight !== undefined && Number(customWeight) > 0) {
    shippingOrder.calculatedWeight = Number(customWeight);
    shippingOrder.weight = Number(customWeight);
  } else {
    const resolvedWeight = calculateOrderShippingWeight(shippingOrder, inventoryProducts, 1);
    shippingOrder.calculatedWeight = resolvedWeight;
    shippingOrder.weight = resolvedWeight;
  }

  return shippingOrder;
}
