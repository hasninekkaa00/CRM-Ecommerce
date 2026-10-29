import { Order, InventoryProduct } from '../types';
import { findInventoryProductAndVariation } from './productCostUtils';

/**
 * Normalizes a weight value to kilograms.
 * If value is > 50, it is assumed to be entered in grams (e.g. 500g or 1200g) and converted to kg (0.5kg, 1.2kg).
 * Otherwise treated as kilograms.
 */
export function normalizeWeightToKg(rawWeight: any): number {
  if (rawWeight === undefined || rawWeight === null || rawWeight === '') return 0;
  const num = typeof rawWeight === 'number' ? rawWeight : parseFloat(String(rawWeight).replace(/,/g, '.').replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) return 0;
  // If weight > 50, it is very likely in grams (e.g. 500g, 1500g) -> convert to kg
  if (num > 50) {
    return Number((num / 1000).toFixed(3));
  }
  return Number(num.toFixed(3));
}

/**
 * Extracts individual product/variation (model) weight directly from inventory products.
 * Prioritizes variation/model weight, then falls back to product weight, then direct item weight.
 */
export function getSingleProductWeight(
  item: { sku?: string; name?: string; productName?: string; variation?: string; variationName?: string; weight?: any; calculatedWeight?: any },
  inventoryProducts?: InventoryProduct[]
): number {
  if (!item) return 0;

  // 1. Prioritize weight directly from inventory for each model/variation or product
  if (inventoryProducts && Array.isArray(inventoryProducts) && inventoryProducts.length > 0) {
    const match = findInventoryProductAndVariation(item, inventoryProducts);

    // 1.1 Specific variation/model weight in inventory
    if (match.variation && match.variation.weight !== undefined && match.variation.weight !== null) {
      const vWeight = normalizeWeightToKg(match.variation.weight);
      if (vWeight > 0) return vWeight;
    }

    // 1.2 Main product weight in inventory
    if (match.product && match.product.weight !== undefined && match.product.weight !== null) {
      const pWeight = normalizeWeightToKg(match.product.weight);
      if (pWeight > 0) return pWeight;
    }

    // 1.3 Secondary search in case variation matching needed loose lookup
    const rawSku = String(item.sku || '').trim().toLowerCase();
    const rawVar = String(item.variation || item.variationName || '').trim().toLowerCase();
    if (rawSku || rawVar) {
      for (const p of inventoryProducts) {
        if (p.variations && Array.isArray(p.variations)) {
          const matchedVar = p.variations.find((v: any) => {
            const vSku = String(v.sku || v.local_sku || '').trim().toLowerCase();
            const vName = String(v.name || v.attributes?.map((a: any) => a.option).join(' ') || '').trim().toLowerCase();
            return (rawSku && vSku && (rawSku === vSku || rawSku.includes(vSku) || vSku.includes(rawSku))) ||
                   (rawVar && vName && (rawVar === vName || rawVar.includes(vName) || vName.includes(rawVar)));
          });
          if (matchedVar && matchedVar.weight !== undefined && matchedVar.weight !== null) {
            const w = normalizeWeightToKg(matchedVar.weight);
            if (w > 0) return w;
          }
        }
      }
    }
  }

  // 2. Direct weight attached to item (e.g. manually specified or stored on item)
  if (item.weight !== undefined && item.weight !== null && Number(item.weight) > 0) {
    return normalizeWeightToKg(item.weight);
  }
  if (item.calculatedWeight !== undefined && item.calculatedWeight !== null && Number(item.calculatedWeight) > 0) {
    return normalizeWeightToKg(item.calculatedWeight);
  }

  return 0;
}

/**
 * Calculates total parcel weight (الميزان) for an order in Kilograms.
 * - Extracts weight directly from inventory for each product / model.
 * - For multi-product or multi-variant orders, sums up all items multiplied by their quantity.
 * - If no weight is found or <= 0, applies defaultFallback (standard: 1 kg).
 */
export function calculateOrderShippingWeight(
  order: any,
  inventoryProducts?: InventoryProduct[],
  defaultFallback: number = 1
): number {
  if (!order) return defaultFallback;

  let totalWeight = 0;
  let hasInventoryWeights = false;

  // 1. Multi-items order (items array)
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    order.items.forEach((it: any) => {
      const qty = Number(it.quantity ?? it.qnts ?? 1) || 1;
      const w = getSingleProductWeight(it, inventoryProducts);
      if (w > 0) {
        hasInventoryWeights = true;
        totalWeight += w * qty;
      }
    });
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
      const w = getSingleProductWeight(singleItem, inventoryProducts);
      if (w > 0) {
        hasInventoryWeights = true;
        totalWeight += w;
      }
    });
  }
  // 3. Single product order
  else {
    const qty = Number(order.qnts ?? 1) || 1;
    const w = getSingleProductWeight(
      { sku: order.sku, productName: order.productName, variation: order.variation },
      inventoryProducts
    );
    if (w > 0) {
      hasInventoryWeights = true;
      totalWeight += w * qty;
    }
  }

  // 4. If inventory weights were found and summed up, return this exact sum!
  if (hasInventoryWeights && totalWeight > 0) {
    return Number(totalWeight.toFixed(3));
  }

  // 5. Fallback: check if order has an existing direct explicit weight
  const directWeight = order.calculatedWeight ?? order.weight ?? order.poids ?? order.totalWeight;
  if (directWeight !== undefined && directWeight !== null && Number(directWeight) > 0) {
    return normalizeWeightToKg(directWeight);
  }

  // 6. Final fallback to default parcel weight (typically 1 kg for Algerian logistics)
  return Number((defaultFallback > 0 ? defaultFallback : 1).toFixed(2));
}

/**
 * Returns a human-friendly Arabic string for weight display
 */
export function formatWeightArabic(kg: number): string {
  if (!kg || isNaN(kg) || kg <= 0) return '1 كغ (افتراضي)';
  if (kg < 1) {
    const grams = Math.round(kg * 1000);
    return `${kg} كغ (${grams} غ)`;
  }
  return `${kg} كغ`;
}
