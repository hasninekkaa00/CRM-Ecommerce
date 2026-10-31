import { Order, InventoryProduct } from '../types';
import { findInventoryProductAndVariation, extractOrderSkus, cleanSku } from './productCostUtils';

/**
 * Normalizes a weight value to kilograms.
 * If value is > 50, it is assumed to be entered in grams (e.g. 500g or 1200g) and converted to kg (0.5kg, 1.2kg).
 * Otherwise treated as kilograms.
 * Preserves 0 as a valid weight (0 kg).
 */
export function normalizeWeightToKg(rawWeight: any): number {
  if (rawWeight === undefined || rawWeight === null || String(rawWeight).trim() === '') return 0;
  const num = typeof rawWeight === 'number' ? rawWeight : parseFloat(String(rawWeight).replace(/,/g, '.').replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num < 0) return 0;
  if (num === 0) return 0;
  if (num > 50) {
    return Number((num / 1000).toFixed(3));
  }
  return Number(num.toFixed(3));
}

export interface ItemWeightResult {
  weight: number;
  foundInInventory: boolean;
  source: 'variation' | 'product' | 'item' | 'default';
}

/**
 * Extracts individual product or variation (model) weight directly from inventory products.
 * STRICTLY prioritizes:
 * 1. Matching variation/model weight in inventory (identified by SKU first, then name/attributes)
 * 2. Main product weight in inventory (only if model has no weight specified)
 * 3. Weight attached to item
 * 4. Default fallback
 *
 * NOTE: If the variation or product has an explicit weight defined (including 0),
 * that value is strictly used and NOT overridden by the parent product or default.
 */
export function getItemInventoryWeight(
  item: { sku?: string; name?: string; productName?: string; variation?: string; variationName?: string; weight?: any; calculatedWeight?: any },
  inventoryProducts?: InventoryProduct[]
): ItemWeightResult {
  if (!item) {
    return { weight: 0, foundInInventory: false, source: 'default' };
  }

  if (inventoryProducts && Array.isArray(inventoryProducts) && inventoryProducts.length > 0) {
    // A. Priority 1: Match variation or product by SKU and properties using central matcher
    const match = findInventoryProductAndVariation(item, inventoryProducts);

    // If specific variation was matched:
    if (match.variation) {
      const v = match.variation;
      // Check if variation has weight field explicitly defined (including 0)
      if (v.weight !== undefined && v.weight !== null && String(v.weight).trim() !== '') {
        return {
          weight: normalizeWeightToKg(v.weight),
          foundInInventory: true,
          source: 'variation'
        };
      }
      // If variation has no weight set, fall back to parent product weight if defined
      if (match.product && match.product.weight !== undefined && match.product.weight !== null && String(match.product.weight).trim() !== '') {
        return {
          weight: normalizeWeightToKg(match.product.weight),
          foundInInventory: true,
          source: 'product'
        };
      }
    }

    // If only main product was matched:
    if (match.product) {
      const p = match.product;
      if (p.weight !== undefined && p.weight !== null && String(p.weight).trim() !== '') {
        return {
          weight: normalizeWeightToKg(p.weight),
          foundInInventory: true,
          source: 'product'
        };
      }
    }

    // B. Direct SKU scan across all variations as extra safety for compound or delimited SKUs
    const rawSkus = extractOrderSkus(item);
    if (rawSkus.length > 0) {
      for (const p of inventoryProducts) {
        if (p.variations && Array.isArray(p.variations)) {
          for (const v of p.variations) {
            const vSku = (v.sku || '').trim().toLowerCase();
            const vLocalSku = (v.local_sku || '').trim().toLowerCase();
            const vClean = cleanSku(v.sku || v.local_sku);
            if (!vSku && !vLocalSku && !vClean) continue;

            const isMatch = rawSkus.some(s => {
              const sLow = s.toLowerCase();
              const sClean = cleanSku(s);
              return (vSku && vSku === sLow) ||
                     (vLocalSku && vLocalSku === sLow) ||
                     (vClean && vClean === sClean);
            });

            if (isMatch) {
              if (v.weight !== undefined && v.weight !== null && String(v.weight).trim() !== '') {
                return {
                  weight: normalizeWeightToKg(v.weight),
                  foundInInventory: true,
                  source: 'variation'
                };
              }
              if (p.weight !== undefined && p.weight !== null && String(p.weight).trim() !== '') {
                return {
                  weight: normalizeWeightToKg(p.weight),
                  foundInInventory: true,
                  source: 'product'
                };
              }
            }
          }
        }
      }
    }
  }

  // 2. Direct weight attached to item (e.g. manually set on item)
  if (item.weight !== undefined && item.weight !== null && String(item.weight).trim() !== '') {
    return {
      weight: normalizeWeightToKg(item.weight),
      foundInInventory: false,
      source: 'item'
    };
  }
  if (item.calculatedWeight !== undefined && item.calculatedWeight !== null && String(item.calculatedWeight).trim() !== '') {
    return {
      weight: normalizeWeightToKg(item.calculatedWeight),
      foundInInventory: false,
      source: 'item'
    };
  }

  return { weight: 0, foundInInventory: false, source: 'default' };
}

/**
 * Returns single product weight as a number
 */
export function getSingleProductWeight(
  item: { sku?: string; name?: string; productName?: string; variation?: string; variationName?: string; weight?: any; calculatedWeight?: any },
  inventoryProducts?: InventoryProduct[]
): number {
  const res = getItemInventoryWeight(item, inventoryProducts);
  return res.weight;
}

/**
 * Calculates total parcel weight (الميزان) for an order in Kilograms.
 * - Extracts weight directly and strictly from inventory for each product / model by SKU.
 * - For multi-product or multi-variant orders, sums up all items multiplied by their quantity.
 * - If explicit weights were found in inventory (including 0), strictly returns the summed weight!
 * - If no weight was defined in inventory or order, applies defaultFallback (standard: 1 kg).
 */
export function calculateOrderShippingWeight(
  order: any,
  inventoryProducts?: InventoryProduct[],
  defaultFallback: number = 1
): number {
  if (!order) return defaultFallback;

  let totalWeight = 0;
  let anyFoundInInventory = false;

  // 1. Multi-items order (items array)
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    order.items.forEach((it: any) => {
      const qty = Number(it.quantity ?? it.qnts ?? 1) || 1;
      const res = getItemInventoryWeight(it, inventoryProducts);
      if (res.foundInInventory) {
        anyFoundInInventory = true;
      }
      totalWeight += res.weight * qty;
    });

    if (anyFoundInInventory) {
      return Number(totalWeight.toFixed(3));
    }
  }
  // 2. Multi-product order defined by compound productName (separated by '+')
  else if (order.productName && String(order.productName).includes('+')) {
    const pNames = String(order.productName).split('+').map(s => s.trim()).filter(Boolean);
    const vNames = String(order.variation || '').split('+').map(s => s.trim());
    const skus = String(order.sku || '').split(/[,+]+/).map(s => s.trim());

    pNames.forEach((name, idx) => {
      const singleItem = {
        productName: name,
        variation: vNames[idx] || '',
        sku: skus[idx] || '',
        qnts: 1
      };
      const res = getItemInventoryWeight(singleItem, inventoryProducts);
      if (res.foundInInventory) {
        anyFoundInInventory = true;
      }
      totalWeight += res.weight;
    });

    if (anyFoundInInventory) {
      return Number(totalWeight.toFixed(3));
    }
  }
  // 3. Single product order
  else {
    const qty = Number(order.qnts ?? 1) || 1;
    const res = getItemInventoryWeight(
      { sku: order.sku, productName: order.productName, variation: order.variation },
      inventoryProducts
    );
    if (res.foundInInventory) {
      return Number((res.weight * qty).toFixed(3));
    }
  }

  // 4. Fallback: check if order has an existing direct explicit weight
  const directWeight = order.calculatedWeight ?? order.weight ?? order.poids ?? order.totalWeight;
  if (directWeight !== undefined && directWeight !== null && String(directWeight).trim() !== '') {
    return normalizeWeightToKg(directWeight);
  }

  // 5. Final fallback to default parcel weight (typically 1 kg for Algerian logistics)
  return Number((defaultFallback >= 0 ? defaultFallback : 1).toFixed(2));
}

/**
 * Returns a human-friendly Arabic string for weight display
 */
export function formatWeightArabic(kg: number): string {
  if (kg === undefined || kg === null || isNaN(kg)) return '1 كغ (افتراضي)';
  if (kg === 0) return '0 كغ';
  if (kg < 1) {
    const grams = Math.round(kg * 1000);
    return `${kg} كغ (${grams} غ)`;
  }
  return `${kg} كغ`;
}
