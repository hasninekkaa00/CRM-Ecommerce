import { InventoryProduct, Order, SystemSettings } from '../types';

/**
 * Normalizes text for robust Arabic and multi-language comparison.
 * Strips diacritics (tashkeel), tatweel, normalizes alef, taa marbuta, yaa, and whitespace.
 */
export const normalizeText = (str: any): string => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) // convert Eastern Arabic digits (١, ٢, ٣...) to (1, 2, 3...)
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics / tashkeel
    .replace(/\u0640/g, '') // remove tatweel (kashida)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\w\s\u0600-\u06FF]/gi, ' ') // replace punctuation & symbols with spaces
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Cleans SKU to alphanumeric and Arabic letters only (removes dashes, spaces, slashes).
 */
export const cleanSku = (sku: any): string => {
  if (!sku) return '';
  return String(sku)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]/gi, '');
};

/**
 * Extracts all distinct SKUs from an order or order item.
 */
export const extractOrderSkus = (orderOrSku: any): string[] => {
  if (!orderOrSku) return [];
  
  const rawSkus: string[] = [];

  if (typeof orderOrSku === 'string') {
    rawSkus.push(orderOrSku);
  } else if (typeof orderOrSku === 'object') {
    if (orderOrSku.sku) rawSkus.push(String(orderOrSku.sku));
    if (orderOrSku.variation_sku) rawSkus.push(String(orderOrSku.variation_sku));
    if (orderOrSku.product_sku) rawSkus.push(String(orderOrSku.product_sku));
    if (orderOrSku.itemSku) rawSkus.push(String(orderOrSku.itemSku));
    
    // Check line items if available
    if (Array.isArray(orderOrSku.items)) {
      orderOrSku.items.forEach((item: any) => {
        if (item.sku) rawSkus.push(String(item.sku));
        if (item.variation_sku) rawSkus.push(String(item.variation_sku));
      });
    }
  }

  const result = new Set<string>();
  rawSkus.forEach((raw) => {
    // Split by comma, semicolon, pipe, slash, plus, or newline
    String(raw)
      .split(/[,;|\n\/+]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .forEach((s) => {
        result.add(s);
        // Also add the cleaned version if different
        const cleaned = cleanSku(s);
        if (cleaned && cleaned !== s) {
          result.add(cleaned);
        }
      });
  });

  return Array.from(result);
};

/**
 * Extracts cost from WooCommerce metadata array or dictionary.
 */
export const extractWooCostMeta = (metaData: any): number => {
  if (!metaData) return 0;

  const costKeys = [
    '_wc_cog_cost',
    'wc_cog_cost',
    '_alg_wc_cog_cost',
    'alg_wc_cog_cost',
    'cost_price',
    '_cost_price',
    'purchase_price',
    '_purchase_price',
    'cost',
    '_cost',
    '_cogs',
    'cogs',
    'buying_price',
    '_buying_price',
    'wholesale_price',
    '_wholesale_price',
    'cost_of_goods',
    '_cost_of_goods',
    'prix_achat',
    '_prix_achat',
    'prix_dachat',
    '_prix_dachat',
    'supplier_cost',
    '_supplier_cost'
  ];

  // If metaData is an Array of { key, value }
  if (Array.isArray(metaData)) {
    // 1. Direct exact key match
    for (const key of costKeys) {
      const item = metaData.find((m: any) => String(m.key || '').toLowerCase() === key.toLowerCase());
      if (item && item.value !== undefined && item.value !== null && item.value !== '') {
        const parsed = parseFloat(String(item.value).replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }

    // 2. Fuzzy key match
    for (const item of metaData) {
      const k = String(item.key || '').toLowerCase();
      if (
        (k.includes('cost') || k.includes('cog') || k.includes('achat') || k.includes('purchase') || k.includes('buying')) &&
        !k.includes('shipping') &&
        !k.includes('delivery') &&
        !k.includes('fee')
      ) {
        if (item.value !== undefined && item.value !== null && item.value !== '') {
          const parsed = parseFloat(String(item.value).replace(/[^0-9.-]/g, ''));
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }
    }
  } else if (typeof metaData === 'object') {
    // If metaData is a key-value object
    for (const key of costKeys) {
      if (metaData[key] !== undefined && metaData[key] !== null) {
        const parsed = parseFloat(String(metaData[key]).replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  }

  return 0;
};

/**
 * Extracts numeric offer multiplier (e.g. 'pack 2', 'عرض 3 قطع', '2 قطع', 'x4') from text
 */
export const extractOfferMultiplier = (text: string): number => {
  if (!text) return 1;
  const t = text.toLowerCase();

  // Explicit Arabic & English patterns
  const patterns = [
    /(?:عرض|باك|بك|pack|lot|set|pack\s*de)\s*(\d+)/i,
    /(\d+)\s*(?:قطع|قطعة|حبات|حبة|علب|علبة|عبوات|عبوة|pcs|pc|items|item)/i,
    /[x×*]\s*(\d+)/i,
    /(\d+)\s*[x×*]/i,
    /(\d+)\s*(?:pieces|piece)/i
  ];

  for (const pat of patterns) {
    const match = t.match(pat);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (val > 0 && val <= 100) return val;
    }
  }

  // Fallback: search for first number in text if contains keywords
  if (t.includes('عرض') || t.includes('باك') || t.includes('pack') || t.includes('كمية') || t.includes('توفير')) {
    const match = t.match(/\d+/);
    if (match) {
      const val = parseInt(match[0], 10);
      if (val > 0 && val <= 100) return val;
    }
  }

  return 1;
};

/**
 * Returns meaningful tokens from product name (ignoring stop words)
 */
const getProductTokens = (name: string): string[] => {
  const norm = normalizeText(name);
  if (!norm) return [];
  const stopWords = new Set(['عرض', 'باك', 'قطع', 'قطعة', 'توصيل', 'مجاني', 'تخفيض', 'الاصلي', 'اصلي', 'جديد', 'pack', 'promo', 'gratuit']);
  return norm
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));
};

export interface MatchProductResult {
  product: InventoryProduct | null;
  variation: any | null;
  matchType: 'variation_sku' | 'product_sku' | 'product_id' | 'name_exact' | 'name_partial' | 'token_overlap' | 'none';
  recognizedSku?: string;
  isOffer?: boolean;
  offerMultiplier?: number;
  extractedUnitCost?: number;
}

/**
 * Matches a specific variation within a product's variations list using:
 * 1. Matching by SKU (if provided SKU matches v.sku or v.local_sku)
 * 2. Matching by variation ID
 * 3. Matching by variation shippingAliasName
 * 4. Matching by variation name / attribute options
 * 5. Matching by Arabic/English ordinal or index (e.g. "نوع 1" / "1" / "الاول" -> 1st variation, "نوع 2" / "2" / "الثاني" -> 2nd variation)
 */
export const matchVariationWithinProduct = (
  variations: any[],
  variationText: string = '',
  specificSkus: string[] = [],
  fallbackIndex?: number
): any => {
  if (!Array.isArray(variations) || variations.length === 0) return null;

  // Clean leading quantity prefixes (e.g. "1 حبة نوع 2" -> "نوع 2", "2x نوع 1" -> "نوع 1", "نوع 2 (1)" -> "نوع 2")
  // But protect single standalone numbers (e.g. "1" or "2" or "3") from being wiped out!
  let cleanedText = (variationText || '').trim();
  if (!/^([1-9]|10)$/.test(cleanedText)) {
    cleanedText = cleanedText
      .replace(/^(\d+)\s*[*xX×]\s*/i, '')
      .replace(/^(\d+)\s*(?:حبة|حبات|قطعة|قطع|pcs|pc|علبة|علب)\s*(?:من)?\s*/i, '')
      .replace(/[\(\[]\s*(\d+)\s*[\)\]]$/i, '')
      .replace(/[*xX×]\s*(\d+)$/i, '')
      .trim();
  }

  const normVar = normalizeText(cleanedText || variationText);

  // If empty and fallbackIndex is provided
  if (!normVar) {
    if (fallbackIndex !== undefined && fallbackIndex >= 0 && fallbackIndex < variations.length) {
      return variations[fallbackIndex];
    }
    return null;
  }

  // =========================================================================
  // Helper: Extract any explicitly declared type number (1 to 10) from a variation object
  // =========================================================================
  const getVariationExplicitTypeNumber = (v: any): number | null => {
    const vText = normalizeText(
      `${v.name || ''} ${v.shippingAliasName || ''} ${
        v.attributes?.map((a: any) => `${a.option || ''} ${a.value || ''}`).join(' ') || ''
      }`
    );

    // Check explicit type keyword in variation
    const tm = vText.match(
      /(?:نوع|النوع|تفرع|التفرع|خيار|الخيار|صنف|الصنف|موديل|الموديل|type|option|variant|model)\s*[:\-_]?\s*([1-9]|10)\b/i
    );
    if (tm) return parseInt(tm[1], 10);

    // Check SKU suffix: e.g. -1, -2, _1, _2
    const vSku = cleanSku(v.sku || v.local_sku || '');
    const skuMatch = vSku.match(/[-_]([1-9]|10)$/);
    if (skuMatch) return parseInt(skuMatch[1], 10);

    // Check Arabic ordinals
    if (vText.includes('عاشر') || vText.includes('العاشر') || vText.includes('عاشره') || vText.includes('العاشرة')) return 10;
    if (vText.includes('تاسع') || vText.includes('التاسع') || vText.includes('تاسعه') || vText.includes('التاسعة')) return 9;
    if (vText.includes('ثامن') || vText.includes('الثامن') || vText.includes('ثامنه') || vText.includes('الثامنة')) return 8;
    if (vText.includes('سابع') || vText.includes('السابع') || vText.includes('سابعه') || vText.includes('السابعة')) return 7;
    if (vText.includes('سادس') || vText.includes('السادس') || vText.includes('سادسه') || vText.includes('السادسة')) return 6;
    if (vText.includes('خامس') || vText.includes('الخامس') || vText.includes('خامسه') || vText.includes('الخامسة')) return 5;
    if (vText.includes('رابع') || vText.includes('الرابع') || vText.includes('رابعه') || vText.includes('الرابعة')) return 4;
    if (vText.includes('ثالث') || vText.includes('الثالث') || vText.includes('ثالته') || vText.includes('الثالثة') || vText.includes('تالت') || vText.includes('التالت')) return 3;
    if (
      vText.includes('ثاني') || vText.includes('الثاني') || vText.includes('ثانى') || vText.includes('الثانى') ||
      vText.includes('ثانيه') || vText.includes('الثانية') || vText.includes('تاني') || vText.includes('التاني') ||
      vText.includes('تانية') || vText.includes('التانية')
    ) return 2;
    if (
      vText.includes('اول') || vText.includes('الاول') || vText.includes('الأول') ||
      vText.includes('اولى') || vText.includes('الاولى') || vText.includes('الأولى')
    ) return 1;

    // Check exact standalone attribute option or value: e.g. "1", "2"
    if (Array.isArray(v.attributes)) {
      for (const a of v.attributes) {
        const optClean = normalizeText(a.option || a.value || '');
        if (/^([1-9]|10)$/.test(optClean)) {
          return parseInt(optClean, 10);
        }
      }
    }

    return null;
  };

  // =========================================================================
  // PRIORITY 1: Explicit Variation / Type Numbers & Arabic / English Ordinals
  // This is the absolute highest priority: prevents any generic token or alias
  // from hijacking a customer's specific type selection (e.g. "النوع 2", "نوع 1")!
  // =========================================================================
  let requestedTypeNumber: number | null = null;

  // 1.1 Explicit keyword + number: e.g. "نوع 2", "النوع 2", "النوع: 2", "خيار 2", "تفرع 2", "صنف 2", "موديل 2", "شكل 2", "لون 2", "حجم 2", "مقاس 2", "رقم 2", "type 2", "option 2", "variant 2"
  const typeMatch = normVar.match(
    /(?:نوع|النوع|تفرع|التفرع|خيار|الخيار|صنف|الصنف|موديل|الموديل|شكل|الشكل|لون|اللون|حجم|الحجم|مقاس|المقاس|طراز|الطراز|نموذج|النموذج|فئة|الفئة|رقم|الرقم|type|option|variant|model|style|choice|color|size|pack|no|nr|#)\s*[:\-_]?\s*([1-9]|10)\b/i
  );
  if (typeMatch) {
    requestedTypeNumber = parseInt(typeMatch[1], 10);
  }

  // 1.2 Arabic / English ordinals (1st to 10th)
  if (!requestedTypeNumber) {
    if (normVar.includes('عاشر') || normVar.includes('العاشر') || normVar.includes('عاشره') || normVar.includes('العاشرة') || normVar.match(/\b10(?:th|eme)\b/i)) {
      requestedTypeNumber = 10;
    } else if (normVar.includes('تاسع') || normVar.includes('التاسع') || normVar.includes('تاسعه') || normVar.includes('التاسعة') || normVar.match(/\b9(?:th|eme)\b/i)) {
      requestedTypeNumber = 9;
    } else if (normVar.includes('ثامن') || normVar.includes('الثامن') || normVar.includes('ثامنه') || normVar.includes('الثامنة') || normVar.match(/\b8(?:th|eme)\b/i)) {
      requestedTypeNumber = 8;
    } else if (normVar.includes('سابع') || normVar.includes('السابع') || normVar.includes('سابعه') || normVar.includes('السابعة') || normVar.match(/\b7(?:th|eme)\b/i)) {
      requestedTypeNumber = 7;
    } else if (normVar.includes('سادس') || normVar.includes('السادس') || normVar.includes('سادسه') || normVar.includes('السادسة') || normVar.match(/\b6(?:th|eme)\b/i)) {
      requestedTypeNumber = 6;
    } else if (normVar.includes('خامس') || normVar.includes('الخامس') || normVar.includes('خامسه') || normVar.includes('الخامسة') || normVar.match(/\b5(?:th|eme)\b/i)) {
      requestedTypeNumber = 5;
    } else if (normVar.includes('رابع') || normVar.includes('الرابع') || normVar.includes('رابعه') || normVar.includes('الرابعة') || normVar.match(/\b4(?:th|eme)\b/i)) {
      requestedTypeNumber = 4;
    } else if (normVar.includes('ثالث') || normVar.includes('الثالث') || normVar.includes('ثالته') || normVar.includes('الثالثة') || normVar.includes('تالت') || normVar.includes('التالت') || normVar.match(/\b3(?:rd|eme)\b/i)) {
      requestedTypeNumber = 3;
    } else if (
      normVar.includes('ثاني') || normVar.includes('الثاني') || normVar.includes('ثانى') || normVar.includes('الثانى') ||
      normVar.includes('ثانيه') || normVar.includes('الثانية') || normVar.includes('تاني') || normVar.includes('التاني') ||
      normVar.includes('تانية') || normVar.includes('التانية') || normVar.match(/\b2(?:nd|eme)\b/i)
    ) {
      requestedTypeNumber = 2;
    } else if (
      normVar.includes('اول') || normVar.includes('الاول') || normVar.includes('الأول') ||
      normVar.includes('اولى') || normVar.includes('الاولى') || normVar.includes('الأولى') || normVar.match(/\b1(?:st|er)\b/i)
    ) {
      requestedTypeNumber = 1;
    }
  }

  // 1.3 Exact standalone number or clean number prefix: "1", "2", "3" or "2 - أحمر", "2/أسود", "(2)"
  if (!requestedTypeNumber) {
    const singleNumMatch = normVar.match(/^([1-9]|10)$/);
    if (singleNumMatch) {
      requestedTypeNumber = parseInt(singleNumMatch[1], 10);
    } else {
      const numPrefixMatch = normVar.match(/^(?:نوع\s*)?([1-9]|10)\s*[\-\/:\)\.]/i);
      if (numPrefixMatch) {
        requestedTypeNumber = parseInt(numPrefixMatch[1], 10);
      }
    }
  }

  // If a specific type number (1 to 10) was requested, find the exact variation that corresponds to it!
  if (requestedTypeNumber !== null) {
    // A. Check if any variation explicitly declares this type number in name, attributes, alias, or SKU
    for (const v of variations) {
      const declaredNum = getVariationExplicitTypeNumber(v);
      if (declaredNum === requestedTypeNumber) {
        return v;
      }
    }

    // B. Check positional index: variations[requestedTypeNumber - 1]
    const posIdx = requestedTypeNumber - 1;
    if (posIdx >= 0 && posIdx < variations.length) {
      const explicitNumAtPos = getVariationExplicitTypeNumber(variations[posIdx]);
      // Verify that this variation doesn't explicitly belong to a DIFFERENT type number!
      if (explicitNumAtPos === null || explicitNumAtPos === requestedTypeNumber) {
        return variations[posIdx];
      }
    }

    // C. Safety: NEVER allow a type-mismatched variation (e.g. Type 1 when Type 2 was requested)
    // to be returned by generic substring matching!
  }

  // =========================================================================
  // PRIORITY 2: Exact Match on Variation Shipping Alias, Name, or Specific SKU
  // =========================================================================

  // 2.1 Exact shipping alias match
  const exactAliasMatch = variations.find((v: any) => {
    const vAlias = normalizeText(v.shippingAliasName || '');
    return vAlias && vAlias === normVar;
  });
  if (exactAliasMatch) return exactAliasMatch;

  // 2.2 Exact variation name match
  const exactNameMatch = variations.find((v: any) => {
    const vName = normalizeText(v.name || '');
    return vName && vName === normVar;
  });
  if (exactNameMatch) return exactNameMatch;

  // 2.3 Match by specific distinct SKU (if provided)
  if (specificSkus.length > 0) {
    for (const s of specificSkus) {
      const sNorm = (s || '').trim().toLowerCase();
      const sClean = cleanSku(s);
      if (!sNorm) continue;
      const found = variations.find((v: any) => {
        const vSku = (v.sku || v.local_sku || '').trim().toLowerCase();
        const vClean = cleanSku(v.sku || v.local_sku);
        return (vSku && vSku === sNorm) || (vClean && vClean === sClean);
      });
      if (found) return found;
    }
  }

  // =========================================================================
  // PRIORITY 3: Attributes Match (Exact option first, then longest non-generic tokens)
  // =========================================================================
  const genericCategoryTokens = new Set([
    'نوع', 'النوع', 'تفرع', 'التفرع', 'خيار', 'الخيار', 'صنف', 'الصنف', 'موديل', 'الموديل', 
    'رقم', 'الرقم', 'لون', 'اللون', 'مقاس', 'المقاس', 'حجم', 'الحجم', 'طول', 'الطول', 'وزن', 'الوزن',
    'type', 'option', 'variant', 'model', 'color', 'size'
  ]);

  // 3.1 Exact attribute option match
  for (const v of variations) {
    if (Array.isArray(v.attributes)) {
      for (const a of v.attributes) {
        const optNorm = normalizeText(a.option || a.value || '');
        if (optNorm && optNorm === normVar) {
          return v;
        }
      }
    }
  }

  // 3.2 Longest distinct attribute option match (word boundary only, ignoring generic words)
  let bestAttrCandidate: any = null;
  let bestAttrLength = 0;
  for (const v of variations) {
    if (Array.isArray(v.attributes)) {
      for (const a of v.attributes) {
        const optNorm = normalizeText(a.option || a.value || '');
        if (!optNorm || optNorm.length < 2 || genericCategoryTokens.has(optNorm)) continue;
        
        const isMatch = normVar === optNorm ||
          normVar.includes(` ${optNorm} `) ||
          normVar.startsWith(`${optNorm} `) ||
          normVar.endsWith(` ${optNorm}`);

        if (isMatch && optNorm.length > bestAttrLength) {
          bestAttrLength = optNorm.length;
          bestAttrCandidate = v;
        }
      }
    }
  }
  if (bestAttrCandidate) return bestAttrCandidate;

  // =========================================================================
  // PRIORITY 4: Whole-Word Shipping Alias / Name Match (Strict word-boundary only)
  // =========================================================================
  let bestAliasCandidate: any = null;
  let bestAliasLength = 0;
  for (const v of variations) {
    const vAlias = normalizeText(v.shippingAliasName || '');
    if (!vAlias || vAlias.length < 2 || genericCategoryTokens.has(vAlias)) continue;
    // Strict whole word or exact token match (never allow arbitrary substring pollution)
    const isMatch = normVar === vAlias ||
      normVar.includes(` ${vAlias} `) ||
      normVar.startsWith(`${vAlias} `) ||
      normVar.endsWith(` ${vAlias}`);
    if (isMatch && vAlias.length > bestAliasLength) {
      bestAliasLength = vAlias.length;
      bestAliasCandidate = v;
    }
  }
  if (bestAliasCandidate) return bestAliasCandidate;

  let bestNameCandidate: any = null;
  let bestNameLength = 0;
  for (const v of variations) {
    const vName = normalizeText(v.name || '');
    if (!vName || vName.length < 2 || genericCategoryTokens.has(vName)) continue;
    const isMatch = normVar === vName ||
      normVar.includes(` ${vName} `) ||
      normVar.startsWith(`${vName} `) ||
      normVar.endsWith(` ${vName}`);
    if (isMatch && vName.length > bestNameLength) {
      bestNameLength = vName.length;
      bestNameCandidate = v;
    }
  }
  if (bestNameCandidate) return bestNameCandidate;

  // =========================================================================
  // PRIORITY 5: Distinct Numeric Tokens (e.g. 100, 200, 500, 38, 40)
  // Only if exact numeric token appears in both variation and order text
  // =========================================================================
  const varNumbers = normVar.match(/\d+(?:\.\d+)?/g);
  if (varNumbers && varNumbers.length > 0) {
    for (const v of variations) {
      const vText = normalizeText(`${v.name || ''} ${v.attributes?.map((a: any) => a.option || a.value).join(' ') || ''}`);
      const vNumbers = vText.match(/\d+(?:\.\d+)?/g);
      if (vNumbers && varNumbers.some(n => vNumbers.includes(n))) {
        return v;
      }
    }
  }

  // Positional fallback if index was provided
  if (fallbackIndex !== undefined && fallbackIndex >= 0 && fallbackIndex < variations.length) {
    return variations[fallbackIndex];
  }

  return null;
};

/**
 * Finds the matching inventory product and variation for an order or item.
 * Supports cross-store matching by SKU, Variation SKU, WooCommerce IDs, or Normalized Names.
 */
export const findInventoryProductAndVariation = (
  order: any,
  inventoryProducts: InventoryProduct[] = []
): MatchProductResult => {
  if (!order || !Array.isArray(inventoryProducts) || inventoryProducts.length === 0) {
    return { product: null, variation: null, matchType: 'none' };
  }

  const orderSkus = extractOrderSkus(order);
  const rawOrderProductName = order.productName || order.name || '';
  const orderProductNameNorm = normalizeText(rawOrderProductName);
  const orderVariationNameNorm = normalizeText(order.variation || order.variationName || '');
  const orderProductId = order.productId || order.product_id || order.id;
  const orderVariationId = order.variationId || order.variation_id;

  // --------------------------------------------------------------------------
  // 1. Check if any order SKU matches a VARIATION SKU directly across all inventory products
  // --------------------------------------------------------------------------
  if (orderSkus.length > 0) {
    for (const prod of inventoryProducts) {
      if (Array.isArray(prod.variations)) {
        for (const v of prod.variations) {
          const vSku = (v.sku || v.local_sku || '').trim().toLowerCase();
          const vSkuClean = cleanSku(v.sku || v.local_sku);

          if (
            (vSku && orderSkus.includes(vSku)) ||
            (vSkuClean && orderSkus.includes(vSkuClean))
          ) {
            // Check if order has a specific variation name that points to a DIFFERENT variation in the same product
            let finalVar = v;
            if (prod.variations.length > 1) {
              const varSearchText = (order.variation || order.variationName || '').trim() || rawOrderProductName;
              if (varSearchText) {
                const betterMatch = matchVariationWithinProduct(prod.variations, varSearchText, []);
                if (betterMatch) {
                  finalVar = betterMatch;
                }
              }
            }

            const isOfferFallback = prod.variations.some((x: any) =>
              x.attributes?.some((a: any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))
            );
            const isOffer = prod.local_is_offers !== undefined ? prod.local_is_offers : isOfferFallback;
            
            let offerMultiplier = finalVar.offer_quantity || 1;
            if (offerMultiplier === 1) {
              const varText = (finalVar.name || '') + ' ' + (finalVar.attributes?.map((a: any) => a.option).join(' ') || '');
              offerMultiplier = extractOfferMultiplier(varText);
            }

            return {
              product: prod,
              variation: finalVar,
              matchType: 'variation_sku',
              recognizedSku: finalVar.sku || finalVar.local_sku || prod.sku,
              isOffer,
              offerMultiplier
            };
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Check if any order SKU matches a MAIN PRODUCT SKU across all inventory products
  // --------------------------------------------------------------------------
  if (orderSkus.length > 0) {
    for (const prod of inventoryProducts) {
      const pSku = (prod.sku || '').trim().toLowerCase();
      const pSkuClean = cleanSku(prod.sku);

      if (
        (pSku && orderSkus.includes(pSku)) ||
        (pSkuClean && orderSkus.includes(pSkuClean))
      ) {
        // Try to find the specific variation if order has variation info
        let matchedVar: any = null;
        if (Array.isArray(prod.variations) && prod.variations.length > 0) {
          const varSearchText = (order.variation || order.variationName || '').trim();
          if (varSearchText) {
            matchedVar = matchVariationWithinProduct(prod.variations, varSearchText, []);
          }
          if (!matchedVar && rawOrderProductName) {
            matchedVar = matchVariationWithinProduct(prod.variations, rawOrderProductName, []);
          }
        }

        const isOfferFallback = Array.isArray(prod.variations) && prod.variations.some((x: any) =>
          x.attributes?.some((a: any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))
        );
        const isOffer = prod.local_is_offers !== undefined ? prod.local_is_offers : isOfferFallback;
        const offerMultiplier = matchedVar?.offer_quantity || extractOfferMultiplier(order.variation || '') || 1;

        return {
          product: prod,
          variation: matchedVar,
          matchType: 'product_sku',
          recognizedSku: matchedVar?.sku || matchedVar?.local_sku || prod.sku,
          isOffer,
          offerMultiplier
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. Match by WooCommerce Product ID / Variation ID
  // --------------------------------------------------------------------------
  if (orderProductId || orderVariationId) {
    for (const prod of inventoryProducts) {
      const prodIdStr = String(prod.id || '');
      const isProdMatch = orderProductId && (
        prodIdStr === String(orderProductId) ||
        prodIdStr.endsWith('_' + orderProductId) ||
        prodIdStr.startsWith(orderProductId + '_')
      );

      if (isProdMatch) {
        let matchedVar: any = null;
        if (orderVariationId && Array.isArray(prod.variations)) {
          matchedVar = prod.variations.find((v: any) => {
            const vIdStr = String(v.id || '');
            return vIdStr === String(orderVariationId) || vIdStr.endsWith('_' + orderVariationId);
          });
        }

        return {
          product: prod,
          variation: matchedVar,
          matchType: 'product_id',
          recognizedSku: matchedVar?.sku || prod.sku,
          isOffer: prod.local_is_offers,
          offerMultiplier: matchedVar?.offer_quantity || 1
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. Match by Product Name (Exact, Substring, and Token Overlap)
  // --------------------------------------------------------------------------
  if (orderProductNameNorm) {
    let matchedProd: InventoryProduct | null = null;
    let matchType: MatchProductResult['matchType'] = 'none';

    // 4.1 Exact normalized name match
    matchedProd = inventoryProducts.find((p) => normalizeText(p.name) === orderProductNameNorm) || null;
    if (matchedProd) {
      matchType = 'name_exact';
    }

    // 4.2 Substring match (either order contains product or product contains order)
    if (!matchedProd) {
      matchedProd = inventoryProducts.find((p) => {
        const pNorm = normalizeText(p.name);
        return pNorm && (orderProductNameNorm.includes(pNorm) || pNorm.includes(orderProductNameNorm));
      }) || null;
      if (matchedProd) {
        matchType = 'name_partial';
      }
    }

    // 4.3 Word Token Overlap Match
    if (!matchedProd) {
      const orderTokens = getProductTokens(rawOrderProductName);
      if (orderTokens.length > 0) {
        let bestOverlapScore = 0;
        let bestCandidate: InventoryProduct | null = null;

        for (const p of inventoryProducts) {
          const pTokens = getProductTokens(p.name);
          if (pTokens.length === 0) continue;

          let matchingTokens = 0;
          for (const ot of orderTokens) {
            if (pTokens.some((pt) => pt === ot || pt.includes(ot) || ot.includes(pt))) {
              matchingTokens++;
            }
          }

          const overlapScore = matchingTokens / Math.min(orderTokens.length, pTokens.length);
          if (overlapScore >= 0.5 && overlapScore > bestOverlapScore) {
            bestOverlapScore = overlapScore;
            bestCandidate = p;
          }
        }

        if (bestCandidate) {
          matchedProd = bestCandidate;
          matchType = 'token_overlap';
        }
      }
    }

    if (matchedProd) {
      let matchedVar: any = null;
      if (Array.isArray(matchedProd.variations) && matchedProd.variations.length > 0) {
        const distinctVarSkus = orderSkus.filter(s => s !== cleanSku(matchedProd.sku));
        // 1. Try order variation text if provided
        if (order.variation || order.variationName) {
          matchedVar = matchVariationWithinProduct(
            matchedProd.variations,
            order.variation || order.variationName,
            distinctVarSkus
          );
        }
        // 2. If no match yet, check rawOrderProductName for variation keywords/type names
        if (!matchedVar && rawOrderProductName) {
          matchedVar = matchVariationWithinProduct(
            matchedProd.variations,
            rawOrderProductName,
            distinctVarSkus
          );
        }
        // 3. Fallback to the single variation if product only has 1 variation
        if (!matchedVar && matchedProd.variations.length === 1) {
          matchedVar = matchedProd.variations[0];
        }
      }

      const isOfferFallback = Array.isArray(matchedProd.variations) && matchedProd.variations.some((x: any) =>
        x.attributes?.some((a: any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))
      );
      const isOffer = matchedProd.local_is_offers !== undefined ? matchedProd.local_is_offers : isOfferFallback;
      const offerMultiplier = matchedVar?.offer_quantity || extractOfferMultiplier(order.variation || rawOrderProductName) || 1;

      return {
        product: matchedProd,
        variation: matchedVar,
        matchType,
        recognizedSku: matchedVar?.sku || matchedVar?.local_sku || matchedProd.sku,
        isOffer,
        offerMultiplier
      };
    }
  }

  return { product: null, variation: null, matchType: 'none' };
};

/**
 * Extracts unit cost from an InventoryProduct or Variation object across all possible cost fields.
 */
export const getProductCostValue = (item: any): number => {
  if (!item || typeof item !== 'object') return 0;

  const costFields = [
    'local_cost',
    'cost',
    'purchase_price',
    'buying_price',
    'wholesale_price',
    'cost_price',
    'cogs',
    'supplier_cost',
    'prix_achat'
  ];

  for (const field of costFields) {
    if (item[field] !== undefined && item[field] !== null && item[field] !== '') {
      const val = parseFloat(String(item[field]).replace(/[^0-9.-]/g, ''));
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // Also check metadata if present
  if (item.meta_data) {
    const metaCost = extractWooCostMeta(item.meta_data);
    if (metaCost > 0) return metaCost;
  }

  // Fallback: If this is a parent product with variations and no parent cost, check variations
  if (Array.isArray(item.variations) && item.variations.length > 0) {
    for (const v of item.variations) {
      const vCost = getProductCostValue(v);
      if (vCost > 0) return vCost;
    }
  }

  return 0;
};

/**
 * Formats display price for a product or variation.
 * If product has variations, displays the base price or min-max range cleanly.
 */
export const getProductDisplayPrice = (product: any): string => {
  if (!product) return 'غير محدد';
  
  const rawP = Number(product.local_price || product.price || product.regular_price || 0);

  if (Array.isArray(product.variations) && product.variations.length > 0) {
    const prices = product.variations
      .map((v: any) => Number(v.local_price || v.price || v.regular_price || v.sale_price || 0))
      .filter((p: number) => !isNaN(p) && p > 0);
    
    if (prices.length > 0) {
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      if (minP === maxP) {
        return `${minP} د.ج`;
      }
      if (rawP > 0 && rawP !== minP && rawP !== maxP) {
        return `${minP} - ${maxP} د.ج (الأساسي: ${rawP} د.ج)`;
      }
      return `${minP} - ${maxP} د.ج`;
    }
  }

  if (!isNaN(rawP) && rawP > 0) return `${rawP} د.ج`;
  return product.price ? `${product.price} د.ج` : 'غير محدد';
};

/**
 * Formats display cost for a product or variation.
 * If product has variations, displays the base cost or min-max cost range cleanly.
 */
export const getProductDisplayCost = (product: any): string => {
  if (!product) return '—';

  // Check direct local_cost or cost
  let directCost = 0;
  const costFields = ['local_cost', 'cost', 'purchase_price', 'buying_price', 'wholesale_price', 'cost_price', 'cogs', 'supplier_cost', 'prix_achat'];
  for (const field of costFields) {
    if (product[field] !== undefined && product[field] !== null && product[field] !== '') {
      const val = parseFloat(String(product[field]).replace(/[^0-9.-]/g, ''));
      if (!isNaN(val) && val > 0) {
        directCost = val;
        break;
      }
    }
  }

  if (Array.isArray(product.variations) && product.variations.length > 0) {
    const costs = product.variations
      .map((v: any) => getProductCostValue(v))
      .filter((c: number) => c > 0);

    if (costs.length > 0) {
      const minC = Math.min(...costs);
      const maxC = Math.max(...costs);
      if (minC === maxC) {
        return `${minC} د.ج`;
      }
      if (directCost > 0 && directCost !== minC && directCost !== maxC) {
        return `${minC} - ${maxC} د.ج (الأساسي: ${directCost} د.ج)`;
      }
      return `${minC} - ${maxC} د.ج`;
    }
  }

  if (directCost > 0) return `${directCost} د.ج`;
  return '—';
};

export interface OrderCostBreakdownItem {
  productName: string;
  variationName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  product?: InventoryProduct | null;
  variation?: any | null;
}

/**
 * Splits a compound variation or compound order string into individual variation parts.
 * Handles:
 * - '+'
 * - '/' or '\'
 * - ',' or Arabic comma '،'
 * - ';' or Arabic semicolon '؛'
 * - '|'
 * - '&'
 * - '\n'
 * - ' - ' or ' – ' or ' — '
 * - ' و ' or ' مع ' or ' et ' or ' and '
 * - Arabic prefixed 'و' attached to variation/number tokens:
 *   e.g. " والنوع", " ونوع", " والتفرع", " وتفرع", " و1", " و2", " والاول", " والثاني"
 * - Consecutive variation tokens: e.g. "النوع 1 النوع 2"
 */
export const splitCompoundVariationString = (str: string): string[] => {
  if (!str) return [];
  const raw = String(str).trim();
  if (!raw) return [];

  // First convert Eastern Arabic numerals (٠-٩) to standard ASCII digits (0-9)
  // and handle connected numbers like 1و2 -> 1 و 2
  const normDigits = raw
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/([0-9])و([0-9])/g, '$1 و $2');

  // Replace common delimiters with a unique delimiter '§§§'
  const separated = normDigits
    .replace(/\s*[\+/,;\|\n&،؛]\s*/g, ' §§§ ')
    .replace(/\s+-\s+|\s+[–—]\s+/g, ' §§§ ')
    .replace(/\s+(?:و|مع|et|and)\s+/gi, ' §§§ ')
    .replace(/\s+و(?=(?:ال)?(?:نوع|تفرع|خيار|[0-9]|اول|ثاني|ثالث|رابع|خامس))/gi, ' §§§ ')
    .replace(/(\b(?:نوع|النوع)\s*[0-9]\b)\s+(\b(?:نوع|النوع)\s*[0-9]\b)/gi, '$1 §§§ $2')
    .replace(/(\b(?:نوع|النوع)\s*(?:اول|الاول|الأول)\b)\s+(\b(?:نوع|النوع)\s*(?:ثاني|الثاني)\b)/gi, '$1 §§§ $2');

  const parts = separated
    .split('§§§')
    .map(p => p.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts : [raw];
};

/**
 * Extracts individual sub-items or variations from an order.
 * Accurately detects:
 * - order.items / line_items array
 * - Multi-product names separated by '+'
 * - Multi-variation strings separated by '+', ',', 'و', 'والنوع', '\n', etc.
 * - Multi-variation SKUs separated by '+' or ','
 * - Quantities > 1 referencing multiple variations
 */
export const extractOrderSubItems = (
  order: any,
  inventoryProducts: InventoryProduct[] = []
): Array<{
  name: string;
  variation: string;
  sku: string;
  quantity: number;
  cost?: number;
  price?: number;
  productId?: string;
  variationId?: string;
}> => {
  if (!order) return [];

  // Helper to reliably find product for order/item using advanced matching
  const findProductForOrder = (pName: string, pSku: string, pVar?: string, pId?: string) => {
    const match = findInventoryProductAndVariation(
      { productName: pName, name: pName, sku: pSku, variation: pVar, productId: pId },
      inventoryProducts
    );
    return match.product;
  };

  // 1. Check if rawItems exist in order.items / products / line_items
  let rawItems = order.items || order.products || order.line_items || order.cart || order.orderedItems;
  if (typeof rawItems === 'string') {
    try {
      rawItems = JSON.parse(rawItems);
    } catch {
      rawItems = null;
    }
  }

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const list: Array<{ name: string; variation: string; sku: string; quantity: number; cost?: number; price?: number; productId?: string; variationId?: string }> = [];
    rawItems.forEach((item: any) => {
      const itName = item.name || item.product_name || item.productName || item.title || order.productName || '';
      let itVar = item.variation || item.variation_name || item.variationName || item.variant_title || item.variant || item.options || '';
      if (Array.isArray(itVar)) {
        itVar = itVar.map((a: any) => (typeof a === 'object' ? (a.option || a.value || a.name || '') : String(a))).filter(Boolean).join(' - ');
      } else if (typeof itVar === 'object' && itVar !== null) {
        itVar = Object.values(itVar).join(' - ');
      }
      if (!itVar && Array.isArray(item.meta_data) && item.meta_data.length > 0) {
        const metaVals = item.meta_data
          .filter((m: any) => !String(m.key || '').startsWith('_'))
          .map((m: any) => String(m.value || '').trim())
          .filter(Boolean);
        if (metaVals.length > 0) itVar = metaVals.join(' - ');
      }
      const itSku = item.sku || item.variation_sku || item.product_sku || '';
      const itQty = Number(item.quantity ?? item.qnts ?? item.qty ?? 1) || 1;
      let itCost = item.cost !== undefined && Number(item.cost) > 0 ? Number(item.cost) : undefined;
      const itPrice = item.price !== undefined ? Number(item.price) : undefined;

      // If cost is not explicitly provided on item, find product and variation
      if (!itCost) {
        const itemMatch = findInventoryProductAndVariation(
          { productName: itName, name: itName, variation: itVar, sku: itSku, productId: item.productId, variationId: item.variationId },
          inventoryProducts
        );
        if (itemMatch.variation) {
          const c = getProductCostValue(itemMatch.variation);
          if (c > 0) itCost = c;
        } else if (itemMatch.product) {
          if (Array.isArray(itemMatch.product.variations) && itemMatch.product.variations.length > 0) {
            const vFound = matchVariationWithinProduct(itemMatch.product.variations, String(itVar), itSku ? [itSku] : []);
            if (vFound) {
              const c = getProductCostValue(vFound);
              if (c > 0) itCost = c;
            }
          }
          if (!itCost) {
            const pC = getProductCostValue(itemMatch.product);
            if (pC > 0) itCost = pC;
          }
        }
      }

      // If itVar itself has multiple variations, split it!
      const vParts = splitCompoundVariationString(String(itVar));
      if (vParts.length > 1) {
        let parentP = findProductForOrder(itName, itSku, itVar, item.productId);
        if (!parentP && inventoryProducts.length > 0) {
          const nNorm = normalizeText(itName);
          parentP = inventoryProducts.find(p => {
            const pNorm = normalizeText(p.name);
            return pNorm && (nNorm.includes(pNorm) || pNorm.includes(nNorm));
          }) || null;
        }

        vParts.forEach((vp, vpIdx) => {
          let partCost: number | undefined = undefined;
          let partSku = itSku;
          if (parentP && Array.isArray(parentP.variations)) {
            const matchedV = matchVariationWithinProduct(parentP.variations, vp, [], vpIdx);
            if (matchedV) {
              const c = getProductCostValue(matchedV);
              if (c > 0) partCost = c;
              if (matchedV.sku || matchedV.local_sku) partSku = matchedV.sku || matchedV.local_sku;
            } else if (parentP.variations.length > vpIdx) {
              const fallbackV = parentP.variations[vpIdx];
              const c = getProductCostValue(fallbackV);
              if (c > 0) partCost = c;
              if (fallbackV.sku || fallbackV.local_sku) partSku = fallbackV.sku || fallbackV.local_sku;
            }
          }
          if (partCost === undefined && itCost !== undefined) {
            partCost = itCost;
          }

          list.push({
            name: itName,
            variation: vp,
            sku: partSku,
            quantity: 1,
            cost: partCost,
            price: itPrice,
            productId: item.productId
          });
        });
        return;
      }

      list.push({
        name: itName,
        variation: String(itVar),
        sku: String(itSku),
        quantity: itQty,
        cost: itCost,
        price: itPrice,
        productId: item.productId,
        variationId: item.variationId
      });
    });

    if (list.length > 1) {
      return list;
    }
  }

  const rawPName = String(order.productName || order.name || '').trim();
  const rawVar = String(order.variation || order.variationName || '').trim();
  const rawSku = String(order.sku || '').trim();
  const orderQty = Number(order.qnts) || 1;

  // 2. Check if order.productName has '+'
  if (rawPName.includes('+')) {
    const pNames = rawPName.split('+').map(s => s.trim()).filter(Boolean);
    if (pNames.length > 1) {
      const vParts = splitCompoundVariationString(rawVar);
      const skuParts = rawSku ? rawSku.split(/[,;\+]+/).map(s => s.trim()).filter(Boolean) : [];
      return pNames.map((pName, idx) => {
        const vp = vParts[idx] || (vParts.length === 1 ? vParts[0] : '');
        const sp = skuParts[idx] || '';
        let itemCost = order.cost ? Number(order.cost) : undefined;
        let parentP = findProductForOrder(pName, sp, vp);
        if (!parentP && inventoryProducts.length > 0) {
          const nNorm = normalizeText(pName);
          parentP = inventoryProducts.find(p => {
            const pNorm = normalizeText(p.name);
            return pNorm && (nNorm.includes(pNorm) || pNorm.includes(nNorm));
          }) || null;
        }

        if (parentP && Array.isArray(parentP.variations) && parentP.variations.length > 0) {
          const matchedV = matchVariationWithinProduct(parentP.variations, vp, sp ? [sp] : [], idx);
          if (matchedV) {
            const c = getProductCostValue(matchedV);
            if (c > 0) itemCost = c;
          } else if (parentP.variations.length > idx) {
            const fallbackV = parentP.variations[idx];
            const c = getProductCostValue(fallbackV);
            if (c > 0) itemCost = c;
          }
        }
        return {
          name: pName,
          variation: vp,
          sku: sp || (skuParts.length === pNames.length ? skuParts[idx] : ''),
          quantity: 1,
          cost: itemCost
        };
      });
    }
  }

  // 3. Check if order.variation has compound variations
  const vParts = splitCompoundVariationString(rawVar);
  if (vParts.length > 1) {
    const skuParts = rawSku ? rawSku.split(/[,;\+]+/).map(s => s.trim()).filter(Boolean) : [];
    let candP = findProductForOrder(rawPName, rawSku, rawVar, order.productId || order.product_id);
    if (!candP && inventoryProducts.length > 0) {
      const pNorm = normalizeText(rawPName);
      candP = inventoryProducts.find(p => {
        const nameNorm = normalizeText(p.name);
        return nameNorm && (pNorm.includes(nameNorm) || nameNorm.includes(pNorm));
      }) || null;
    }

    return vParts.map((vp, idx) => {
      let q = 1;
      let cleanV = vp;
      const leadMatch = vp.match(/^(\d+)\s*[*xX×]\s*(.+)$/);
      if (leadMatch) {
        q = parseInt(leadMatch[1], 10) || 1;
        cleanV = leadMatch[2].trim();
      } else {
        const trailMatch = vp.match(/^(.+?)\s*[\(\[]\s*(\d+)\s*[\)\]]$/) || vp.match(/^(.+?)\s*[*xX×]\s*(\d+)$/);
        if (trailMatch) {
          q = parseInt(trailMatch[2], 10) || 1;
          cleanV = trailMatch[1].trim();
        }
      }

      let partCost: number | undefined = undefined;
      let partSku = skuParts.length === vParts.length ? skuParts[idx] : '';

      if (candP && Array.isArray(candP.variations) && candP.variations.length > 0) {
        const matchedV = matchVariationWithinProduct(candP.variations, cleanV, partSku ? [partSku] : [], idx);
        if (matchedV) {
          const c = getProductCostValue(matchedV);
          if (c > 0) partCost = c;
          if (!partSku && (matchedV.sku || matchedV.local_sku)) {
            partSku = matchedV.sku || matchedV.local_sku;
          }
        } else if (candP.variations.length > idx) {
          const fallbackV = candP.variations[idx];
          const c = getProductCostValue(fallbackV);
          if (c > 0) partCost = c;
          if (!partSku && (fallbackV.sku || fallbackV.local_sku)) {
            partSku = fallbackV.sku || fallbackV.local_sku;
          }
        }
      }

      return {
        name: candP?.name || rawPName,
        variation: cleanV,
        sku: partSku,
        quantity: q,
        cost: partCost
      };
    });
  }

  // 4. Check if order.sku has multiple distinct variation SKUs
  if (rawSku && (rawSku.includes('+') || rawSku.includes(',') || rawSku.includes(';'))) {
    const skuParts = rawSku.split(/[,;\+]+/).map(s => s.trim()).filter(Boolean);
    if (skuParts.length > 1) {
      const matchedVars: any[] = [];
      for (const s of skuParts) {
        const sLower = s.toLowerCase();
        for (const p of inventoryProducts) {
          if (Array.isArray(p.variations)) {
            const v = p.variations.find((x: any) => (x.sku || x.local_sku || '').trim().toLowerCase() === sLower);
            if (v) {
              matchedVars.push({ product: p, variation: v, sku: s });
              break;
            }
          }
        }
      }
      if (matchedVars.length > 1) {
        return matchedVars.map(mv => ({
          name: mv.product.name,
          variation: mv.variation.name || mv.variation.attributes?.map((a: any) => a.option).join(' - ') || '',
          sku: mv.sku,
          quantity: 1,
          cost: getProductCostValue(mv.variation) || getProductCostValue(mv.product)
        }));
      }
    }
  }

  // 5. If orderQty > 1 and order variation refers to multiple variations of the product
  if (orderQty > 1) {
    let candP = findProductForOrder(rawPName, rawSku, rawVar, order.productId || order.product_id);
    if (!candP && inventoryProducts.length > 0) {
      const pNorm = normalizeText(rawPName);
      candP = inventoryProducts.find(p => {
        const nameNorm = normalizeText(p.name);
        return nameNorm && (pNorm.includes(nameNorm) || nameNorm.includes(pNorm));
      }) || null;
    }

    if (candP && Array.isArray(candP.variations) && candP.variations.length > 1) {
      // Check if multiple distinct variations match keywords/numbers in order.variation
      const matchedVariations: any[] = [];
      const rawVarNorm = normalizeText(rawVar);
      const rawPNorm = normalizeText(rawPName);

      const vParts = splitCompoundVariationString(rawVar);
      if (vParts.length > 1) {
        vParts.forEach((vp, vpIdx) => {
          const mv = matchVariationWithinProduct(candP.variations, vp, [], vpIdx);
          if (mv && !matchedVariations.includes(mv)) {
            matchedVariations.push(mv);
          }
        });
      }

      // If quantity is 2 and there are at least 2 variations, and the text mentions dual variations or has delimiters or numbers 1 & 2
      if (matchedVariations.length < 2 && orderQty === 2 && candP.variations.length >= 2) {
        if (
          rawVarNorm.includes('نوعين') || rawVarNorm.includes('النوعين') || rawVarNorm.includes('مشكل') ||
          rawVarNorm.includes('مشكلة') || rawVarNorm.includes('مختلف') || rawVarNorm.includes('مختلفين') ||
          rawVarNorm.includes('مختلفتين') || rawVarNorm.includes('كوكتيل') || rawVarNorm.includes('مخلط') ||
          rawVarNorm.includes('قطعتين') || rawVarNorm.includes('تفرعين') || rawVarNorm.includes('خيارين') ||
          rawVarNorm.includes('حبة من كل') || rawVarNorm.includes('واحد من كل') || rawVarNorm.includes('من كل نوع') ||
          rawVarNorm.includes('كل نوع') || rawVarNorm.includes('حبة حبة') || rawVarNorm.includes('1-2') ||
          rawVarNorm.includes('1+2') || rawVarNorm.includes('1/2') || rawVarNorm.includes('1 و 2') ||
          rawVarNorm.includes('الاول و الثاني') || rawVarNorm.includes('الأول والثاني') ||
          rawVarNorm.includes('+') || rawVarNorm.includes('/') || rawVarNorm.includes(',') || rawVarNorm.includes('،') ||
          rawVarNorm.includes(' - ') || rawVarNorm.includes(' و ') ||
          (rawVarNorm.includes('1') && rawVarNorm.includes('2')) ||
          (rawVarNorm.includes('اول') && rawVarNorm.includes('ثاني')) ||
          (!rawVarNorm || rawVarNorm === 'افتراضي' || rawVarNorm === 'default')
        ) {
          matchedVariations.length = 0;
          matchedVariations.push(candP.variations[0], candP.variations[1]);
        }
      }

      if (matchedVariations.length > 1) {
        return matchedVariations.map(mv => ({
          name: candP.name,
          variation: mv.name || mv.attributes?.map((a: any) => a.option).join(' - ') || '',
          sku: mv.sku || mv.local_sku || candP.sku || '',
          quantity: 1,
          cost: getProductCostValue(mv) || getProductCostValue(candP)
        }));
      }
    }
  }

  // Fallback: single item
  return [{
    name: rawPName,
    variation: rawVar,
    sku: rawSku,
    quantity: orderQty,
    cost: order.cost ? Number(order.cost) : undefined
  }];
};

/**
 * Calculates the exact unit cost and total COGS for an order.
 * Follows a cascade:
 * 1. Explicit user override on order (customProductCost) if manually set > 0
 * 2. Multi-item / Multi-variation breakdown: accurately sums distinct variation costs (Cost 1 + Cost 2) rather than multiplying a single price by 2
 * 3. Matched variation's cost (local_cost / cost / purchase_price / meta)
 * 4. Offer variation multiplier * single unit cost
 * 5. Parent product's cost (local_cost / cost / purchase_price / meta)
 * 6. Sibling variation cost (if parent is 0)
 * 7. System settings productCosts dictionary (by SKU, clean SKU, or Product Name)
 * 8. Fallback to 0
 */
export const getOrderUnitAndTotalCost = (
  order: any,
  inventoryProducts: InventoryProduct[] = [],
  settings?: SystemSettings | null
): {
  unitCost: number;
  totalCogs: number;
  extCost: number;
  recognizedProduct: InventoryProduct | null;
  recognizedVariation: any | null;
  matchType: string;
  calculatedQuantity: number;
  isCustomOverride: boolean;
  breakdown?: OrderCostBreakdownItem[];
} => {
  const extCost = Number(order?.customAdditionalCost || 0);

  // 1. Check for multi-item or multi-variation breakdown (order.items, or variations separated by '+', ',', 'و', etc.)
  // Accurate breakdown of distinct items MUST take precedence over single-item multiplier overrides
  const subItems = extractOrderSubItems(order, inventoryProducts);

  if (subItems.length > 1) {
    const breakdown: OrderCostBreakdownItem[] = [];

    for (let itIdx = 0; itIdx < subItems.length; itIdx++) {
      const it = subItems[itIdx];
      const itQty = Number(it.quantity) || 1;
      let itUnitCost = 0;
      let matchedP: InventoryProduct | null = null;
      let matchedV: any = null;

      if (it.cost !== undefined && Number(it.cost) > 0) {
        itUnitCost = Number(it.cost);
        const match = findInventoryProductAndVariation(it, inventoryProducts);
        matchedP = match.product;
        matchedV = match.variation;
      } else {
        const match = findInventoryProductAndVariation(it, inventoryProducts);
        matchedP = match.product;
        matchedV = match.variation;

        if (matchedP && Array.isArray(matchedP.variations) && !matchedV) {
          matchedV = matchVariationWithinProduct(matchedP.variations, it.variation, extractOrderSkus(it), itIdx);
        }

        const vCost = matchedV ? getProductCostValue(matchedV) : 0;
        const pCost = matchedP ? getProductCostValue(matchedP) : 0;

        if (vCost > 0) {
          itUnitCost = vCost;
        } else if (matchedP && Array.isArray(matchedP.variations) && itIdx < matchedP.variations.length && getProductCostValue(matchedP.variations[itIdx]) > 0) {
          matchedV = matchedP.variations[itIdx];
          itUnitCost = getProductCostValue(matchedV);
        } else if (pCost > 0) {
          itUnitCost = pCost;
        } else if (matchedP && Array.isArray(matchedP.variations)) {
          const sib = matchedP.variations.find((v: any) => getProductCostValue(v) > 0);
          if (sib) itUnitCost = getProductCostValue(sib);
        }

        if (itUnitCost === 0 && settings?.productCosts) {
          const skus = extractOrderSkus(it);
          for (const s of skus) {
            if (settings.productCosts[s] !== undefined && Number(settings.productCosts[s]) > 0) {
              itUnitCost = Number(settings.productCosts[s]);
              break;
            }
          }
          if (itUnitCost === 0 && it.variation) {
            const normVar = normalizeText(it.variation);
            if (settings.productCosts[normVar] !== undefined && Number(settings.productCosts[normVar]) > 0) {
              itUnitCost = Number(settings.productCosts[normVar]);
            }
          }
          if (itUnitCost === 0 && it.name) {
            const normName = normalizeText(it.name);
            if (settings.productCosts[normName] !== undefined && Number(settings.productCosts[normName]) > 0) {
              itUnitCost = Number(settings.productCosts[normName]);
            }
          }
        }
      }

      breakdown.push({
        productName: matchedP?.name || it.name || order.productName || '',
        variationName: matchedV?.name || matchedV?.attributes?.map((a: any) => a.option).join(' - ') || it.variation || '',
        sku: matchedV?.sku || matchedV?.local_sku || it.sku || matchedP?.sku || '',
        quantity: itQty,
        unitCost: itUnitCost,
        totalCost: itUnitCost * itQty,
        product: matchedP,
        variation: matchedV
      });
    }

    const itemsTotalCogs = breakdown.reduce((sum, b) => sum + b.totalCost, 0);
    const totalQty = breakdown.reduce((sum, b) => sum + b.quantity, 0) || Number(order?.qnts) || 1;
    const recognizedProduct = breakdown.find(b => b.product)?.product || null;
    const recognizedVariation = breakdown.length === 1 ? breakdown[0].variation : null;

    return {
      unitCost: totalQty > 0 ? itemsTotalCogs / totalQty : itemsTotalCogs,
      totalCogs: itemsTotalCogs,
      extCost,
      recognizedProduct,
      recognizedVariation,
      matchType: 'items_breakdown',
      calculatedQuantity: totalQty,
      isCustomOverride: false,
      breakdown
    };
  }

  // 2. Explicit manual custom cost override on this specific single-item order
  if (
    order?.customProductCost !== undefined &&
    order?.customProductCost !== null &&
    Number(order.customProductCost) > 0
  ) {
    const rawQty = Number(order?.qnts) || 1;
    const total = Number(order.customProductCost);
    const uCost = rawQty > 0 ? total / rawQty : total;
    return {
      unitCost: uCost,
      totalCogs: total,
      extCost,
      recognizedProduct: null,
      recognizedVariation: null,
      matchType: 'custom_override',
      calculatedQuantity: rawQty,
      isCustomOverride: true,
      breakdown: [{
        productName: order.productName || '',
        variationName: order.variation || '',
        sku: order.sku || '',
        quantity: rawQty,
        unitCost: uCost,
        totalCost: total
      }]
    };
  }

  // 3. Standard match for single-item order
  const match = findInventoryProductAndVariation(order, inventoryProducts);
  const { product, variation, isOffer, offerMultiplier } = match;

  let unitCost = 0;
  let calculatedQty = Number(order?.qnts) || 1;

  if (product) {
    // Safety check: if order has calculatedQty > 1 and product has variations, check if multiple variations are referenced
    if (Array.isArray(product.variations) && product.variations.length > 1 && calculatedQty > 1) {
      const rawV = order.variation || order.variationName || '';
      const rawVNorm = normalizeText(rawV);
      const rawPNorm = normalizeText(order.productName || '');

      const matchedMultiVars: any[] = [];
      const vParts = splitCompoundVariationString(rawV);
      if (vParts.length > 1) {
        vParts.forEach((vp, vpIdx) => {
          const mv = matchVariationWithinProduct(product.variations, vp, [], vpIdx);
          if (mv && !matchedMultiVars.includes(mv)) {
            matchedMultiVars.push(mv);
          }
        });
      }

      // If quantity is 2 and there are at least 2 variations, and the text mentions dual variations or has delimiters or numbers 1 & 2
      if (matchedMultiVars.length < 2 && calculatedQty === 2 && product.variations.length >= 2) {
        if (
          rawVNorm.includes('نوعين') || rawVNorm.includes('النوعين') || rawVNorm.includes('مشكل') ||
          rawVNorm.includes('مشكلة') || rawVNorm.includes('مختلف') || rawVNorm.includes('مختلفين') ||
          rawVNorm.includes('مختلفتين') || rawVNorm.includes('كوكتيل') || rawVNorm.includes('مخلط') ||
          rawVNorm.includes('قطعتين') || rawVNorm.includes('تفرعين') || rawVNorm.includes('خيارين') ||
          rawVNorm.includes('+') || rawVNorm.includes('/') || rawVNorm.includes(',') || rawVNorm.includes('،') ||
          rawVNorm.includes(' - ') || rawVNorm.includes(' و ') ||
          (rawVNorm.includes('1') && rawVNorm.includes('2')) ||
          (rawVNorm.includes('اول') && rawVNorm.includes('ثاني')) ||
          (!rawVNorm || rawVNorm === 'افتراضي' || rawVNorm === 'default')
        ) {
          matchedMultiVars.length = 0;
          matchedMultiVars.push(product.variations[0], product.variations[1]);
        }
      }

      if (matchedMultiVars.length > 1) {
        const multiBreakdown: OrderCostBreakdownItem[] = matchedMultiVars.map(mv => {
          const c = getProductCostValue(mv) || getProductCostValue(product);
          return {
            productName: product.name,
            variationName: mv.name || mv.attributes?.map((a: any) => a.option).join(' - ') || '',
            sku: mv.sku || mv.local_sku || product.sku || '',
            quantity: 1,
            unitCost: c,
            totalCost: c,
            product,
            variation: mv
          };
        });

        const itemsTotalCogs = multiBreakdown.reduce((sum, b) => sum + b.totalCost, 0);
        return {
          unitCost: itemsTotalCogs / calculatedQty,
          totalCogs: itemsTotalCogs,
          extCost,
          recognizedProduct: product,
          recognizedVariation: null,
          matchType: 'compound_variations_match',
          calculatedQuantity: calculatedQty,
          isCustomOverride: false,
          breakdown: multiBreakdown
        };
      }
    }

    const pCost = getProductCostValue(product);

    if (variation) {
      const vCost = getProductCostValue(variation);

      if (vCost > 0) {
        unitCost = vCost;
      } else if (isOffer && (offerMultiplier || 1) > 1) {
        // For offers (e.g. 2 pieces pack), find the single item cost and multiply
        const singleVar = product.variations?.find((v: any) =>
          getProductCostValue(v) > 0 &&
          !v.attributes?.some((a: any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))
        );
        const singleCost = singleVar ? getProductCostValue(singleVar) : pCost;
        unitCost = singleCost;
        calculatedQty = (Number(order?.qnts) || 1) * (offerMultiplier || 1);
      } else if (pCost > 0) {
        // Fallback to parent product cost
        unitCost = pCost;
      } else if (Array.isArray(product.variations)) {
        // Sibling variation fallback
        const siblingWithCost = product.variations.find((v: any) => getProductCostValue(v) > 0);
        if (siblingWithCost) {
          unitCost = getProductCostValue(siblingWithCost);
        }
      }
    } else {
      // Simple product or parent product matched
      if (pCost > 0) {
        unitCost = pCost;
      } else if (Array.isArray(product.variations)) {
        // Fallback to first variation with cost
        const varWithCost = product.variations.find((v: any) => getProductCostValue(v) > 0);
        if (varWithCost) {
          unitCost = getProductCostValue(varWithCost);
        }
      }
    }
  }

  // 4. Fallback to settings.productCosts dictionary if inventory didn't have cost
  if (unitCost === 0 && settings?.productCosts) {
    const orderSkus = extractOrderSkus(order);
    for (const s of orderSkus) {
      if (settings.productCosts[s] !== undefined && Number(settings.productCosts[s]) > 0) {
        unitCost = Number(settings.productCosts[s]);
        break;
      }
    }
    if (unitCost === 0 && order?.productName) {
      const pNameNorm = normalizeText(order.productName);
      if (settings.productCosts[pNameNorm] !== undefined && Number(settings.productCosts[pNameNorm]) > 0) {
        unitCost = Number(settings.productCosts[pNameNorm]);
      } else {
        // Also check if any key in settings.productCosts matches order product name partially
        for (const [key, val] of Object.entries(settings.productCosts)) {
          const normKey = normalizeText(key);
          if (normKey && (pNameNorm.includes(normKey) || normKey.includes(pNameNorm)) && Number(val) > 0) {
            unitCost = Number(val);
            break;
          }
        }
      }
    }
  }

  const totalCogs = unitCost * calculatedQty;

  const breakdown: OrderCostBreakdownItem[] = [{
    productName: product?.name || order.productName || '',
    variationName: variation?.name || order.variation || '',
    sku: variation?.sku || product?.sku || order.sku || '',
    quantity: calculatedQty,
    unitCost,
    totalCost: totalCogs,
    product,
    variation
  }];

  return {
    unitCost,
    totalCogs,
    extCost,
    recognizedProduct: product,
    recognizedVariation: variation,
    matchType: match.matchType,
    calculatedQuantity: calculatedQty,
    isCustomOverride: false,
    breakdown
  };
};

/**
 * Resolves product and variation names according to user's alias hierarchy:
 * 1. If variation-specific shipping alias is written (الاسم المستعار المدون للنوع): use it.
 * 2. Else if general product alias exists (الاسم العام مع زيادة النوع): use general product alias + variation name.
 * 3. Else (إذا تركت فارغة): use original product name + original variation name.
 */
export const resolveShippingDisplayNames = (
  order: { productName?: string; variation?: string; sku?: string },
  inventoryProducts: InventoryProduct[] = []
): { productName: string; variation: string; fullTitle: string } => {
  const match = findInventoryProductAndVariation(order, inventoryProducts);
  let matchedProd = match.product;
  let matchedVar = match.variation;

  // Extra safety: If product has variations, ensure variation is accurately matched to order's requested variation or product title
  if (matchedProd && Array.isArray(matchedProd.variations) && matchedProd.variations.length > 0) {
    const rawVar = (order.variation || '').trim();
    const rawProd = (order.productName || '').trim();
    if (rawVar) {
      const explicitVar = matchVariationWithinProduct(matchedProd.variations, rawVar);
      if (explicitVar) {
        matchedVar = explicitVar;
      }
    } else if (rawProd) {
      const explicitVar = matchVariationWithinProduct(matchedProd.variations, rawProd);
      if (explicitVar) {
        matchedVar = explicitVar;
      }
    }
  }

  const originalProdName = (order.productName || matchedProd?.name || '').trim();
  const originalVarName = (order.variation || matchedVar?.name || matchedVar?.attributes?.map((a: any) => a.option).join(' ') || '').trim();

  const varAlias = (matchedVar?.shippingAliasName || '').trim();
  const hasProdAlias = !!(matchedProd?.shippingAliasName?.trim() && matchedProd?.useShippingAlias !== false);
  const prodAlias = hasProdAlias ? matchedProd!.shippingAliasName!.trim() : '';

  let finalProdName = originalProdName;
  let finalVarName = originalVarName;

  // Case 1: Variation alias is explicitly written ("الاسم المستعار المدون للنوع")
  if (varAlias) {
    if (prodAlias) {
      if (varAlias.toLowerCase().includes(prodAlias.toLowerCase())) {
        finalProdName = varAlias;
        finalVarName = '';
      } else {
        finalProdName = prodAlias;
        finalVarName = varAlias;
      }
    } else {
      if (originalProdName && !varAlias.toLowerCase().includes(originalProdName.toLowerCase()) && varAlias.length < 25) {
        finalProdName = originalProdName;
        finalVarName = varAlias;
      } else {
        finalProdName = varAlias;
        finalVarName = '';
      }
    }
  }
  // Case 2: Variation alias left empty, but general product alias exists ("الاسم العام مع زيادة النوع")
  else if (prodAlias) {
    finalProdName = prodAlias;
    finalVarName = originalVarName;
  }
  // Case 3: Both empty ("إذا تركت فارغة يتم أخذ الاسم الأصلي مع النوع الأصلي")
  else {
    finalProdName = originalProdName;
    finalVarName = originalVarName;
  }

  // Build clean unified title (avoiding repetitive terms)
  let fullTitle = '';
  if (finalProdName && finalVarName) {
    if (finalVarName.toLowerCase().includes(finalProdName.toLowerCase()) || finalProdName.toLowerCase().includes(finalVarName.toLowerCase())) {
      fullTitle = finalVarName.length >= finalProdName.length ? finalVarName : finalProdName;
    } else {
      fullTitle = `${finalProdName} (${finalVarName})`;
    }
  } else {
    fullTitle = finalProdName || finalVarName;
  }

  return {
    productName: finalProdName,
    variation: finalVarName,
    fullTitle
  };
};
