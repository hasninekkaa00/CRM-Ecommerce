export interface ProductOption {
  key: string;
  label: string;
  isAllVariations?: boolean;
  isVariation?: boolean;
  productId?: string;
  productName?: string;
  parentKey?: string;
  childVariationKeys?: string[];
  variationsCount?: number;
}

/**
 * Builds a structured, hierarchical list of selectable products and variations for campaign linking.
 * Always guarantees that products with variations include an authoritative "(كل الأنواع)" option,
 * regardless of whether the parent product has an explicit SKU or whether variations contain offer tags.
 */
export function buildUniqueProductsData(inventoryProducts: any[] = [], orders: any[] = []): ProductOption[] {
  const list: ProductOption[] = [];
  const addedKeys = new Set<string>();

  (inventoryProducts || []).forEach((inv: any) => {
    if (!inv || !inv.name) return;

    const hasVariations = Array.isArray(inv.variations) && inv.variations.length > 0;

    if (hasVariations) {
      const childKeys: string[] = [];
      const variationItems: ProductOption[] = [];

      inv.variations.forEach((v: any, idx: number) => {
        const vSku = (v.sku || '').trim();
        const vKey = vSku || `var_${inv.id}_${v.id || idx}`;
        const variationName = v.name || v.attributes?.map((a: any) => a.option || a.value || '').filter(Boolean).join(' ') || `نوع ${idx + 1}`;
        const label = `${inv.name} - ${variationName}`;

        childKeys.push(vKey);
        variationItems.push({
          key: vKey,
          label,
          isVariation: true,
          productId: String(inv.id),
          productName: inv.name,
          parentKey: inv.sku ? String(inv.sku).trim() : `prod_${inv.id}`
        });
      });

      // 1. ALWAYS add the "كل الأنواع" option for any product with variations/models
      const parentKey = inv.sku ? String(inv.sku).trim() : `prod_${inv.id}`;

      list.push({
        key: parentKey,
        label: `${inv.name} (كل الأنواع)`,
        isAllVariations: true,
        productId: String(inv.id),
        productName: inv.name,
        childVariationKeys: childKeys,
        variationsCount: childKeys.length
      });
      addedKeys.add(parentKey);

      // 2. Add each individual variation
      variationItems.forEach(vItem => {
        if (!addedKeys.has(vItem.key)) {
          list.push(vItem);
          addedKeys.add(vItem.key);
        }
      });
    } else {
      // Simple product without variations
      const key = (inv.sku || '').trim() || `prod_${inv.id}`;
      if (!addedKeys.has(key)) {
        list.push({
          key,
          label: inv.name,
          productId: String(inv.id),
          productName: inv.name
        });
        addedKeys.add(key);
      }
    }
  });

  // Include standalone SKUs from orders not present in inventory
  (orders || []).forEach((o: any) => {
    const oSku = (o.sku || '').trim();
    if (oSku && !addedKeys.has(oSku)) {
      list.push({
        key: oSku,
        label: o.productName || oSku
      });
      addedKeys.add(oSku);
    }
  });

  return list;
}

/**
 * Checks if a product or variation is selected.
 * For "(كل الأنواع)", it returns true if its key is selected OR all of its child variation keys are selected.
 */
export function isProductChecked(product: ProductOption, currentSelected: string[]): boolean {
  if (!currentSelected || currentSelected.length === 0) return false;
  if (product.isAllVariations && product.childVariationKeys && product.childVariationKeys.length > 0) {
    return currentSelected.includes(product.key) || product.childVariationKeys.every(k => currentSelected.includes(k));
  }
  return currentSelected.includes(product.key);
}

/**
 * Toggles a product or variation in the selected products list.
 * Selecting "(كل الأنواع)" selects ALL models/variations of that product.
 * Deselecting "(كل الأنواع)" deselects all models/variations of that product.
 * Selecting all individual models automatically marks "(كل الأنواع)" as selected.
 */
export function toggleProductSelection(
  product: ProductOption,
  currentSelected: string[],
  uniqueProducts: ProductOption[]
): string[] {
  if (product.isAllVariations && product.childVariationKeys) {
    const isCurrentlyChecked = isProductChecked(product, currentSelected);

    if (isCurrentlyChecked) {
      // Uncheck "كل الأنواع" and all of its variations
      const keysToRemove = new Set([product.key, ...product.childVariationKeys]);
      return currentSelected.filter(k => !keysToRemove.has(k));
    } else {
      // Check "كل الأنواع" and ALL of its variations!
      const next = new Set(currentSelected);
      next.add(product.key);
      product.childVariationKeys.forEach(k => next.add(k));
      return Array.from(next);
    }
  } else if (product.isVariation && product.parentKey) {
    // Toggling an individual variation
    const isChecked = currentSelected.includes(product.key);
    let next: string[];
    if (isChecked) {
      next = currentSelected.filter(k => k !== product.key);
    } else {
      next = [...currentSelected, product.key];
    }

    // Check parent "كل الأنواع" option
    const parentOption = uniqueProducts.find(p => p.key === product.parentKey && p.isAllVariations);
    if (parentOption && parentOption.childVariationKeys) {
      const allChildrenSelected = parentOption.childVariationKeys.every(k => next.includes(k));
      if (allChildrenSelected && !next.includes(parentOption.key)) {
        next.push(parentOption.key);
      } else if (!allChildrenSelected && next.includes(parentOption.key)) {
        next = next.filter(k => k !== parentOption.key);
      }
    }
    return next;
  } else {
    // Standard simple product
    if (currentSelected.includes(product.key)) {
      return currentSelected.filter(k => k !== product.key);
    } else {
      return [...currentSelected, product.key];
    }
  }
}

/**
 * Returns human-friendly badge items for linked products on campaign cards and headers.
 * If all variations of a product are linked, it consolidates them into a single clean badge.
 */
export function getDisplayLinkedBadges(
  linkedProducts: string[] | undefined,
  uniqueProducts: ProductOption[]
): { key: string; label: string; isAll?: boolean }[] {
  if (!linkedProducts || linkedProducts.length === 0) return [];
  const displayBadges: { key: string; label: string; isAll?: boolean }[] = [];
  const processedVariationKeys = new Set<string>();

  // Check parent products with all variations
  uniqueProducts.forEach(p => {
    if (p.isAllVariations && p.childVariationKeys && p.childVariationKeys.length > 0) {
      const hasParentKey = linkedProducts.includes(p.key);
      const allChildrenIncluded = p.childVariationKeys.every(k => linkedProducts.includes(k));

      if (hasParentKey || allChildrenIncluded) {
        displayBadges.push({
          key: p.key,
          label: p.label,
          isAll: true
        });
        p.childVariationKeys.forEach(k => processedVariationKeys.add(k));
        processedVariationKeys.add(p.key);
      }
    }
  });

  // Add individual variations/products not already consolidated
  linkedProducts.forEach(k => {
    if (!processedVariationKeys.has(k)) {
      const found = uniqueProducts.find(item => item.key === k);
      displayBadges.push({
        key: k,
        label: found?.label || k
      });
    }
  });

  return displayBadges;
}
