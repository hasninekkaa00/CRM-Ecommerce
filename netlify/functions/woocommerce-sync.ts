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

function extractCostFromMeta(metaData: any[]): number {
  if (!Array.isArray(metaData) || metaData.length === 0) return 0;
  
  const costKeys = [
    '_wc_cog_cost', 'wc_cog_cost', '_alg_wc_cog_cost', 'alg_wc_cog_cost',
    'cost_price', '_cost_price', 'purchase_price', '_purchase_price',
    'cost', '_cost', '_cogs', 'cogs', 'buying_price', '_buying_price',
    'wholesale_price', '_wholesale_price', 'cost_of_goods', '_cost_of_goods',
    'prix_achat', '_prix_achat'
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

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), { 
      status: 405, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  }

  try {
    const body = await req.json();
    const { storeUrl, consumerKey, consumerSecret, status = "processing", channelName, page = 1, perPage = 100 } = body;
    
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return new Response(JSON.stringify({ success: false, message: "Missing store URL or API keys" }), { 
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    let baseUrl = storeUrl.trim().replace(/\/+$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }

    const queryStatus = (status === 'all' || status === 'any') ? undefined : status;
    const qParams = new URLSearchParams();
    if (queryStatus) qParams.append('status', queryStatus);
    qParams.append('per_page', String(Math.min(Number(perPage) || 100, 100)));
    qParams.append('page', String(Number(page) || 1));

    const authHeader = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const headerUrl = `${baseUrl}/wp-json/wc/v3/orders?${qParams.toString()}`;

    let wooRes = await fetch(headerUrl, {
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000)
    }).catch(() => null);

    if (!wooRes || !wooRes.ok) {
      const fallbackParams = new URLSearchParams(qParams);
      fallbackParams.append('consumer_key', consumerKey);
      fallbackParams.append('consumer_secret', consumerSecret);
      const fallbackUrl = `${baseUrl}/wp-json/wc/v3/orders?${fallbackParams.toString()}`;
      wooRes = await fetch(fallbackUrl, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
    }

    if (!wooRes.ok) {
      const errorText = await wooRes.text().catch(() => "");
      return new Response(JSON.stringify({ success: false, message: `فشل جلب الطلبيات (${wooRes.status})` }), {
        status: wooRes.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const orders = await wooRes.json();

    if (!Array.isArray(orders)) {
      return new Response(JSON.stringify({ success: false, message: "صيغة البيانات غير صالحة" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const mappedOrders = orders.map((orderData: any) => {
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

    return new Response(JSON.stringify({ success: true, count: mappedOrders.length, orders: mappedOrders }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    console.error("Netlify WooCommerce Sync Error:", error);
    return new Response(JSON.stringify({ success: false, message: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};
