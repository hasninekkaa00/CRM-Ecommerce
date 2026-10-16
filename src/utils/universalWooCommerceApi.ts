async function fetchWooCommerce(baseUrl: string, endpoint: string, consumerKey: string, consumerSecret: string, queryParams: Record<string, string | number> = {}): Promise<any> {
  const qParams = new URLSearchParams();
  for (const [key, val] of Object.entries(queryParams)) {
    qParams.append(key, String(val));
  }
  
  const qStr = qParams.toString();
  const urlSep = qStr ? '&' : ''; // consumer_key is always appended first for simplicity
  
  // Method 1: Pretty Permalinks
  const prettyUrl = `${baseUrl}/wp-json/wc/v3/${endpoint}?consumer_key=${encodeURIComponent(consumerKey.trim())}&consumer_secret=${encodeURIComponent(consumerSecret.trim())}${urlSep}${qStr}`;
  
  let res = await fetch(prettyUrl).catch(() => null);
  if (res && res.ok) {
    return await res.json();
  }
  
  // Method 2: Pretty Permalinks with Proxy
  const prettyProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(prettyUrl)}`;
  res = await fetch(prettyProxyUrl).catch(() => null);
  if (res && res.ok) {
    return await res.json();
  }
  
  // Method 3: Plain Permalinks
  const plainUrl = `${baseUrl}/index.php?rest_route=/wc/v3/${endpoint}&consumer_key=${encodeURIComponent(consumerKey.trim())}&consumer_secret=${encodeURIComponent(consumerSecret.trim())}${urlSep}${qStr}`;
  res = await fetch(plainUrl).catch(() => null);
  if (res && res.ok) {
    return await res.json();
  }
  
  // Method 4: Plain Permalinks with Proxy
  const plainProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(plainUrl)}`;
  res = await fetch(plainProxyUrl).catch(() => null);
  if (res && res.ok) {
    return await res.json();
  }
  
  return null;
}

function getUtmFromMeta(metaData: any[], utmKey: string): string {
  if (!Array.isArray(metaData)) return "";
  const cleanKey = utmKey.toLowerCase().replace(/_/g, "").trim();
  
  const found = metaData.find(m => {
    const k = String(m.key || "").toLowerCase().trim();
    const kNoUnderscores = k.replace(/_/g, "");
    
    return k === utmKey || 
           k === `_${utmKey}` || 
           k.endsWith(`_${utmKey}`) ||
           k.endsWith(utmKey) ||
           kNoUnderscores.endsWith(cleanKey) ||
           kNoUnderscores.includes(cleanKey);
  });
  return found ? String(found.value || "").trim() : "";
}

export function extractCostFromMeta(metaData: any[]): number {
  if (!Array.isArray(metaData) || metaData.length === 0) return 0;
  
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
    '_prix_achat'
  ];

  for (const key of costKeys) {
    const item = metaData.find((m: any) => String(m.key || '').toLowerCase() === key.toLowerCase());
    if (item && item.value !== undefined && item.value !== null && item.value !== '') {
      const parsed = parseFloat(String(item.value).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  for (const item of metaData) {
    const k = String(item.key || '').toLowerCase();
    if ((k.includes('cost') || k.includes('cog') || k.includes('achat') || k.includes('purchase') || k.includes('buying')) && !k.includes('shipping') && !k.includes('delivery')) {
      if (item.value !== undefined && item.value !== null && item.value !== '') {
        const parsed = parseFloat(String(item.value).replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  }

  return 0;
}

export interface SyncWooCommerceParams {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  status?: string;
  channelName?: string;
  page?: number;
  perPage?: number;
}

export async function universalSyncWooCommerce(params: SyncWooCommerceParams): Promise<{ success: boolean; count: number; orders: any[]; message?: string }> {
  const { storeUrl, consumerKey, consumerSecret, status = "processing", channelName, page = 1, perPage = 100 } = params;

  if (!storeUrl || !consumerKey || !consumerSecret) {
    return { success: false, count: 0, orders: [], message: "بيانات متجر WooCommerce أو مفاتيح API غير متوفرة" };
  }

  // 1. Try local backend / Netlify function
  try {
    const response = await fetch('/api/woocommerce/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeUrl,
        consumerKey,
        consumerSecret,
        status,
        channelName,
        page,
        perPage
      })
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('application/json') || (!text.trim().startsWith('<') && !text.includes('<!doctype') && !text.includes('<!DOCTYPE') && !text.includes('<html'))) {
      try {
        const data = JSON.parse(text);
        if (data && typeof data === 'object') {
          if (data.success) {
            return data;
          }
          // If server returned a meaningful failure, try direct client as fallback, but keep server message if direct also fails
          console.warn('[WooCommerce Sync] Server returned unsuccessful sync:', data.message);
        }
      } catch (e) {
        // Fall through to client direct
      }
    }
  } catch (e) {
    console.warn('[WooCommerce Sync] Local endpoint failed, running client-side direct sync...');
  }

  // 2. Direct client-side sync
  return await executeDirectWooCommerceOrdersSync(params);
}

async function executeDirectWooCommerceOrdersSync(params: SyncWooCommerceParams): Promise<{ success: boolean; count: number; orders: any[]; message?: string }> {
  const { storeUrl, consumerKey, consumerSecret, status = "processing", channelName, page = 1, perPage = 100 } = params;

  let baseUrl = storeUrl.trim().replace(/\/+$/, '');
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }

  const queryStatus = (status === 'all' || status === 'any') ? undefined : status;
  const qParams = new URLSearchParams();
  if (queryStatus) qParams.append('status', queryStatus);
  qParams.append('per_page', String(Math.min(Number(perPage) || 100, 100)));
  qParams.append('page', String(Number(page) || 1));

  const authHeader = 'Basic ' + btoa(`${consumerKey.trim()}:${consumerSecret.trim()}`);
  const directEndpointUrl = `${baseUrl}/wp-json/wc/v3/orders?${qParams.toString()}`;

  // Fallback with consumer_key & consumer_secret query params
  const fallbackParams = new URLSearchParams(qParams);
  fallbackParams.append('consumer_key', consumerKey.trim());
  fallbackParams.append('consumer_secret', consumerSecret.trim());
  const queryAuthUrl = `${baseUrl}/wp-json/wc/v3/orders?${fallbackParams.toString()}`;

  let ordersRaw: any[] | null = null;
  let lastError = '';

  const safeParseArray = (txt: string) => {
    if (!txt || typeof txt !== 'string') return null;
    const trimmed = txt.trim();
    if (trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE') || trimmed.includes('<html')) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  // Attempt 1: Direct Header Auth
  try {
    const res = await fetch(directEndpointUrl, {
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const text = await res.text().catch(() => '');
    const arr = safeParseArray(text);
    if (res.ok && arr) {
      ordersRaw = arr;
    } else {
      lastError = `Status ${res.status}`;
    }
  } catch (err: any) {
    lastError = err.message || String(err);
  }

  // Attempt 2: Direct Query Param Auth
  if (!ordersRaw) {
    try {
      const res = await fetch(queryAuthUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
      const text = await res.text().catch(() => '');
      const arr = safeParseArray(text);
      if (res.ok && arr) {
        ordersRaw = arr;
      }
    } catch (err: any) {
      // Continue to plain permalinks
    }
  }

  // Attempt 2.5: Plain Permalinks format (?rest_route=/wc/v3/orders)
  if (!ordersRaw) {
    try {
      const plainParams = new URLSearchParams(fallbackParams);
      plainParams.append('rest_route', '/wc/v3/orders');
      const plainUrl = `${baseUrl}/index.php?${plainParams.toString()}`;
      const res = await fetch(plainUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
      const text = await res.text().catch(() => '');
      const arr = safeParseArray(text);
      if (res.ok && arr) {
        ordersRaw = arr;
      }
    } catch (err: any) {
      // Continue to proxy
    }
  }

  // Attempt 3: Public CORS Proxy fallback (for client-side CORS issues)
  if (!ordersRaw) {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(queryAuthUrl)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
      const text = await res.text().catch(() => '');
      const arr = safeParseArray(text);
      if (res.ok && arr) {
        ordersRaw = arr;
      }
    } catch (err: any) {
      // Continue
    }
  }

  if (!ordersRaw || !Array.isArray(ordersRaw)) {
    return {
      success: false,
      count: 0,
      orders: [],
      message: `فشل الاتصال بمتجر WooCommerce (${lastError || 'يرجى التحقق من صحة المفاتيح وعمل الرابط'}).`
    };
  }

  const mappedOrders = ordersRaw.map((orderData: any) => {
    let rawCity = orderData.billing?.city || orderData.shipping?.city || '';
    if (rawCity.toLowerCase().includes('ain azal') || rawCity.includes('عين ازال') || rawCity.includes('عين أزال')) {
      rawCity = 'Ain Azel';
    }
    return {
      id: String(orderData.id),
      orderId: String(orderData.number || orderData.id),
      orderDate: orderData.date_created ? new Date(orderData.date_created).toISOString() : new Date().toISOString(),
      fullName: `${orderData.billing?.first_name || ''} ${orderData.billing?.last_name || ''}`.trim(),
      phone: orderData.billing?.phone || '',
      region: orderData.billing?.state || orderData.billing?.region || orderData.shipping?.state || '',
      city: rawCity,
      productName: orderData.line_items?.map((i: any) => `${i.name}`).join(' + ') || 'منتج غير معروف',
      variation: orderData.line_items?.map((i: any) => {
        if (i.meta_data && i.meta_data.length > 0) {
          return i.meta_data.map((m: any) => m.value).join(', ');
        }
        return '';
      }).filter(Boolean).join(' + ') || '',
      qnts: orderData.line_items?.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) || 1,
      priceWithoutDelivery: Number(orderData.total || 0) - Number(orderData.shipping_total || 0),
      deliveryPrice: Number(orderData.shipping_total || 0),
      totalCharge: Number(orderData.total || 0),
      shippingMethod: orderData.shipping_lines?.[0]?.method_title || 'توصيل للمنزل',
      confirmedBy: '',
      status1: 'جديد',
      deliveryCompany: '',
      postponementDate: '',
      status2: '',
      ip: orderData.customer_ip_address || '',
      sku: orderData.line_items?.map((i: any) => i.sku).filter(Boolean).join(', ') || '',
      notes: orderData.customer_note || '',
      items: (orderData.line_items || []).map((item: any) => ({
        id: String(item.id || ''),
        productId: String(item.product_id || ''),
        variationId: String(item.variation_id || ''),
        name: item.name || '',
        sku: item.sku || '',
        quantity: Number(item.quantity) || 1,
        price: Number(item.price || item.total || 0),
        cost: extractCostFromMeta(item.meta_data) || undefined
      })),
      utmSource: getUtmFromMeta(orderData.meta_data, "utm_source"),
      utmMedium: getUtmFromMeta(orderData.meta_data, "utm_medium"),
      utmCampaign: getUtmFromMeta(orderData.meta_data, "utm_campaign"),
      utmContent: getUtmFromMeta(orderData.meta_data, "utm_content"),
      pysLanding: getUtmFromMeta(orderData.meta_data, "pys_landing"),
      pysSource: getUtmFromMeta(orderData.meta_data, "pys_source"),
      pysFirstVisit: getUtmFromMeta(orderData.meta_data, "pys_first_visit"),
      pysLastVisit: getUtmFromMeta(orderData.meta_data, "pys_last_visit"),
      pysUtmSource: getUtmFromMeta(orderData.meta_data, "pys_utm_source"),
      pysUtmMedium: getUtmFromMeta(orderData.meta_data, "pys_utm_medium"),
      pysUtmCampaign: getUtmFromMeta(orderData.meta_data, "pys_utm_campaign"),
      sourceChannel: channelName || undefined,
    };
  });

  return { success: true, count: mappedOrders.length, orders: mappedOrders };
}

export async function universalSyncWooCommerceProducts(params: { storeUrl: string; consumerKey: string; consumerSecret: string }): Promise<{ success: boolean; count: number; products: any[]; message?: string }> {
  const { storeUrl, consumerKey, consumerSecret } = params;

  if (!storeUrl || !consumerKey || !consumerSecret) {
    return { success: false, count: 0, products: [], message: "بيانات الاعتماد غير متوفرة" };
  }

  // 1. Try local endpoint first
  try {
    const response = await fetch('/api/woocommerce/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeUrl, consumerKey, consumerSecret })
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('application/json') || (!text.trim().startsWith('<') && !text.includes('<!doctype'))) {
      const data = JSON.parse(text);
      if (data && data.success) {
        return data;
      }
    }
  } catch (e) {
    // Proceed to direct
  }

  // 2. Direct client-side products fetch
  let baseUrl = storeUrl.trim().replace(/\/+$/, '');
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }

  
    let productsRaw: any[] | null = await fetchWooCommerce(baseUrl, 'products', consumerKey, consumerSecret, { per_page: 100 });
  
  if (!productsRaw || !Array.isArray(productsRaw)) {
    return { success: false, count: 0, products: [], message: "فشل استيراد المنتجات من المتجر" };
  }

  const mappedProducts = productsRaw.map((p: any) => {
    const productCost = extractCostFromMeta(p.meta_data);
    const rawWeight = p.weight !== undefined && p.weight !== null && p.weight !== '' ? parseFloat(String(p.weight).replace(/,/g, '.')) : undefined;
    const productWeight = typeof rawWeight === 'number' && !isNaN(rawWeight) ? rawWeight : undefined;

    return {
      id: String(p.id),
      name: p.name,
      sku: p.sku || '',
      price: Number(p.price || 0),
      regular_price: p.regular_price || undefined,
      sale_price: p.sale_price || undefined,
      local_cost: productCost > 0 ? productCost : undefined,
      weight: productWeight,
      type: p.type,
      manage_stock: p.manage_stock ?? false,
      stock_quantity: p.stock_quantity !== null && p.stock_quantity !== undefined ? Number(p.stock_quantity) : 0,
      stock_status: p.stock_status || 'instock',
      image: p.images && p.images.length > 0 ? p.images[0].src : '',
      images: p.images || [],
      variations: (p.variations || []).map((v: any, idx: number) => {
        const vCost = extractCostFromMeta(v.meta_data);
        const rawVWeight = v.weight !== undefined && v.weight !== null && v.weight !== '' ? parseFloat(String(v.weight).replace(/,/g, '.')) : undefined;
        const vWeight = typeof rawVWeight === 'number' && !isNaN(rawVWeight) ? rawVWeight : productWeight;

        return {
          id: String(v.id || v),
          sku: (typeof v === 'object' && v.sku ? v.sku : '') || `${p.sku || p.id}-VAR-${(typeof v === 'object' ? v.id : v) || idx + 1}`,
          name: (typeof v === 'object' && v.attributes ? v.attributes.map((a: any) => a.option).join(' - ') : '') || (typeof v === 'object' && v.name ? v.name : '') || `تفرع ${idx + 1}`,
          price: Number(v.price || 0),
          regular_price: v.regular_price || undefined,
          sale_price: v.sale_price || undefined,
          local_cost: vCost > 0 ? vCost : (productCost > 0 ? productCost : undefined),
          weight: vWeight,
          stock_quantity: v.stock_quantity !== null && v.stock_quantity !== undefined ? Number(v.stock_quantity) : 0,
          stock_status: v.stock_status || 'instock',
          attributes: v.attributes || []
        };
      })
    };
  });

  return { success: true, count: mappedProducts.length, products: mappedProducts };
}

export async function universalSyncWooCommerceSingleProduct(params: { storeUrl: string; consumerKey: string; consumerSecret: string; productId: string }): Promise<{ success: boolean; product?: any; message?: string }> {
  const { storeUrl, consumerKey, consumerSecret, productId } = params;

  if (!storeUrl || !consumerKey || !consumerSecret || !productId) {
    return { success: false, message: "بيانات الاعتماد غير متوفرة" };
  }

  let productRaw: any = null;
  let variationsRaw: any[] = [];

  // 1. Try local endpoint first
  try {
    const response = await fetch('/api/woocommerce/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeUrl, consumerKey, consumerSecret, productId })
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('application/json') || (!text.trim().startsWith('<') && !text.includes('<!doctype'))) {
      const data = JSON.parse(text);
      if (data && data.success && data.product) {
        productRaw = data.product;
        variationsRaw = data.variations || [];
      } else {
        return { success: false, message: data.message || "فشل استيراد المنتج من المتجر" };
      }
    }
  } catch (e) {
    // Proceed to direct
  }

  // 2. Direct client-side products fetch fallback
  if (!productRaw) {
    let baseUrl = storeUrl.trim().replace(/\/+$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }
    
    
    productRaw = await fetchWooCommerce(baseUrl, `products/${productId}`, consumerKey, consumerSecret);
  
    if (!productRaw || !productRaw.id) {
      return { success: false, message: "فشل استيراد المنتج من المتجر. تأكد من صحة الرابط والصلاحيات." };
    }

    if (productRaw.variations && Array.isArray(productRaw.variations) && productRaw.variations.length > 0) {
      variationsRaw = await fetchWooCommerce(baseUrl, `products/${productId}/variations`, consumerKey, consumerSecret, { per_page: 100 }) || [];
    }
  }

  const productCost = extractCostFromMeta(productRaw.meta_data);
  const rawWeight = productRaw.weight !== undefined && productRaw.weight !== null && productRaw.weight !== '' ? parseFloat(String(productRaw.weight).replace(/,/g, '.')) : undefined;
  const productWeight = typeof rawWeight === 'number' && !isNaN(rawWeight) ? rawWeight : undefined;

  const mappedProduct = {
    id: String(productRaw.id),
    name: productRaw.name,
    price: productRaw.price || productRaw.regular_price || "0",
    regular_price: productRaw.regular_price,
    sale_price: productRaw.sale_price,
    stock_status: productRaw.stock_status,
    images: productRaw.images || [],
    sku: productRaw.sku || `SKU-${productRaw.id}`,
    cost: productCost,
    local_cost: productCost > 0 ? productCost : undefined,
    weight: productWeight,
    variations: [] as any[]
  };

  if (Array.isArray(variationsRaw)) {
    mappedProduct.variations = variationsRaw.map((v: any, idx: number) => {
      const varCost = extractCostFromMeta(v.meta_data);
      const rawVWeight = v.weight !== undefined && v.weight !== null && v.weight !== '' ? parseFloat(String(v.weight).replace(/,/g, '.')) : undefined;
      const varWeight = typeof rawVWeight === 'number' && !isNaN(rawVWeight) ? rawVWeight : productWeight;

      return {
        id: String(v.id),
        name: v.attributes?.map((a: any) => a.option).join(' - ') || `تفرع ${idx + 1}`,
        price: v.price || v.regular_price || mappedProduct.price,
        regular_price: v.regular_price,
        sale_price: v.sale_price,
        stock_status: v.stock_status,
        sku: v.sku || `${mappedProduct.sku}-VAR-${v.id}`,
        attributes: v.attributes,
        cost: varCost,
        local_cost: varCost > 0 ? varCost : (productCost > 0 ? productCost : undefined),
        weight: varWeight
      };
    });
  }

  return { success: true, product: mappedProduct };
}
