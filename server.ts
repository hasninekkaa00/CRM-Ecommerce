import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import bodyParser from "body-parser";
import { createServer as createViteServer } from "vite";
import { registerAiRoutes } from "./server/aiRoutes";

let ecotrackCommunes: any[] = [];
try {
  ecotrackCommunes = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "ecotrack-communes.json"), "utf8"));
} catch(e) {
  console.log("Error loading communes:", e);
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json({ limit: "50mb" }));
  app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

  // --- API Routes ---
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Assistant Route
  registerAiRoutes(app);

  function getUtmFromMeta(metaData: any[], utmKey: string): string {
    if (!Array.isArray(metaData)) return "";
    const cleanKey = utmKey.toLowerCase().replace(/_/g, "").trim(); // "utmsource"
    
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

  // WooCommerce Webhook Endpoint
  // Example Webhook format from WooCommerce (Order Created)
  app.post("/api/webhooks/woocommerce", (req, res) => {
    try {
      const orderData = req.body;
      
      console.log("=========================================");
      console.log("📦 Received a webhook from WooCommerce!");
      console.log("Order ID:", orderData.id);
      console.log("Customer:", orderData.billing?.first_name, orderData.billing?.last_name);
      console.log("Total:", orderData.total);
      console.log("=========================================");
      
      // Perform Data Mapping (this maps Woo info to your structure)
      const mappedOrder = {
        id: String(orderData.id),
        orderId: String(orderData.number || orderData.id),
        orderDate: orderData.date_created ? new Date(orderData.date_created).toISOString() : new Date().toISOString(),
        fullName: `${orderData.billing?.first_name || ''} ${orderData.billing?.last_name || ''}`.trim(),
        phone: orderData.billing?.phone || '',
        region: orderData.billing?.state || orderData.billing?.region || orderData.shipping?.state || '',
        city: orderData.billing?.city || orderData.shipping?.city || '',
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
      };

      // TODO: Firebase Admin integration for server-side writes
      // For now, in MVP we print the mapped data to verify webhook connectivity
      console.log("Mapped Order payload:", mappedOrder);
      
      res.status(200).json({ success: true, message: "Order processed successfully", mappedOrder });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // --- WooCommerce REST API Integration with Robust Fallback ---
  async function fetchWooCommerce(
    storeUrl: string,
    endpoint: string,
    consumerKey: string,
    consumerSecret: string,
    queryParams: Record<string, string | number> = {}
  ): Promise<Response> {
    let baseUrl = storeUrl.replace(/\/+$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }

    // Build standard query parameters
    const qParams = new URLSearchParams();
    for (const [key, val] of Object.entries(queryParams)) {
      qParams.append(key, String(val));
    }
    const qStr = qParams.toString();
    const urlSep = qStr ? '?' : '';

    const commonHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };

    const headerUrl = `${baseUrl}/wp-json/wc/v3/${endpoint}${urlSep}${qStr}`;
    const authHeader = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
      const response = await fetch(headerUrl, {
        headers: {
          ...commonHeaders,
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(60000)
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (response.ok && isJson) {
        return response;
      }
      
      // If it's 404 AND it returned JSON, it means the WooCommerce API works but the resource (e.g. product) wasn't found.
      if (response.status === 404 && isJson) {
        return response;
      }
      
      console.log(`[WooCommerce Sync] Header Auth returned status ${response.status} (${contentType}). Trying Query Params...`);
    } catch (err: any) {
      console.log(`[WooCommerce Sync] Header Auth request failed: ${err.message || err}. Trying Query Params...`);
    }

    // Fallback 1: Append consumer_key and consumer_secret as URL query parameters
    const fallbackParams = new URLSearchParams(qParams);
    fallbackParams.append('consumer_key', consumerKey);
    fallbackParams.append('consumer_secret', consumerSecret);
    
    const fallbackUrl = `${baseUrl}/wp-json/wc/v3/${endpoint}?${fallbackParams.toString()}`;
    
    try {
      const fbResponse = await fetch(fallbackUrl, {
        headers: commonHeaders,
        signal: AbortSignal.timeout(60000)
      });
      
      const fbContentType = fbResponse.headers.get('content-type') || '';
      const fbIsJson = fbContentType.includes('application/json');

      if (fbResponse.ok && fbIsJson) {
        return fbResponse;
      }
      if (fbResponse.status === 404 && fbIsJson) {
        return fbResponse;
      }
      
      console.log(`[WooCommerce Sync] Query Param Auth returned status ${fbResponse.status} (${fbContentType}). Trying Plain Permalinks...`);
    } catch (err: any) {
      console.log(`[WooCommerce Sync] Query Param Auth request failed: ${err.message || err}. Trying Plain Permalinks...`);
    }

    // Fallback 2: Plain permalinks format (?rest_route=/wc/v3/...)
    const plainParams = new URLSearchParams();
    plainParams.append('rest_route', `/wc/v3/${endpoint}`);
    plainParams.append('consumer_key', consumerKey);
    plainParams.append('consumer_secret', consumerSecret);
    for (const [key, val] of Object.entries(queryParams)) {
      plainParams.append(key, String(val));
    }
    
    const plainUrl = `${baseUrl}/index.php?${plainParams.toString()}`;
    
    return await fetch(plainUrl, {
      headers: commonHeaders,
      signal: AbortSignal.timeout(60000)
    });
  }

  function parseWooCommerceJson(text: string): { data: any; isHtml: boolean; isValid: boolean } {
    if (!text || typeof text !== 'string') {
      return { data: null, isHtml: false, isValid: false };
    }
    const trimmed = text.trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.toLowerCase().includes('<html>')) {
      const firstBracket = trimmed.indexOf('[');
      const firstBrace = trimmed.indexOf('{');
      let startIdx = -1;
      if (firstBracket !== -1 && firstBrace !== -1) {
        startIdx = Math.min(firstBracket, firstBrace);
      } else if (firstBracket !== -1) {
        startIdx = firstBracket;
      } else if (firstBrace !== -1) {
        startIdx = firstBrace;
      }

      if (startIdx !== -1 && !trimmed.slice(0, startIdx).includes('</html>')) {
        try {
          const parsed = JSON.parse(trimmed.substring(startIdx));
          return { data: parsed, isHtml: false, isValid: true };
        } catch (e) {}
      }
      return { data: null, isHtml: true, isValid: false };
    }

    try {
      return { data: JSON.parse(trimmed), isHtml: false, isValid: true };
    } catch (err) {
      const firstBracket = trimmed.indexOf('[');
      const firstBrace = trimmed.indexOf('{');
      let startIdx = -1;
      if (firstBracket !== -1 && firstBrace !== -1) {
        startIdx = Math.min(firstBracket, firstBrace);
      } else if (firstBracket !== -1) {
        startIdx = firstBracket;
      } else if (firstBrace !== -1) {
        startIdx = firstBrace;
      }
      if (startIdx !== -1) {
        try {
          const parsed = JSON.parse(trimmed.substring(startIdx));
          return { data: parsed, isHtml: false, isValid: true };
        } catch (e2) {}
      }
      return { data: null, isHtml: false, isValid: false };
    }
  }

  function extractCostFromMeta(metaData: any[]): number {
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

  app.post("/api/woocommerce/sync", async (req, res) => {
    try {
      const { storeUrl, consumerKey, consumerSecret, status = "processing", channelName, page = 1, perPage = 100 } = req.body;
      
      if (!storeUrl || !consumerKey || !consumerSecret) {
        return res.status(200).json({ success: false, count: 0, orders: [], message: "بيانات متجر WooCommerce أو مفاتيح API غير متوفرة" });
      }

      const cleanStoreUrl = String(storeUrl).trim().replace(/\/+$/, '');
      const queryStatus = (status === 'all' || status === 'any') ? undefined : status;

      const wooRes = await fetchWooCommerce(cleanStoreUrl, "orders", consumerKey.trim(), consumerSecret.trim(), {
        ...(queryStatus ? { status: queryStatus } : {}),
        per_page: Math.min(Number(perPage) || 100, 100),
        page: Number(page) || 1
      });

      const responseText = await wooRes.text().catch(() => "");
      const { data: parsedData, isHtml, isValid } = parseWooCommerceJson(responseText);

      if (!wooRes.ok) {
        console.error("WooCommerce API Error:", wooRes.status, responseText.slice(0, 300));
        const errMsg = isValid && parsedData?.message 
          ? parsedData.message 
          : `فشل جلب الطلبيات. المتجر رد بالرمز (${wooRes.status}). يرجى التأكد من صحة المفاتيح وعمل الرابط بمعدل الحماية.`;
        return res.status(200).json({ 
          success: false, 
          count: 0,
          orders: [],
          message: errMsg 
        });
      }

      if (isHtml || !isValid || !Array.isArray(parsedData)) {
        console.error("Invalid WooCommerce response for store:", cleanStoreUrl, "Preview:", responseText.slice(0, 300));
        const customMsg = isHtml 
          ? `المتجر أعاد صفحة ويب (HTML) بدلاً من بيانات JSON. يرجى تفعيل الروابط الدائمة (Permalinks على Post name) وتفعيل REST API في ووردبريس، والتحقق من صحة الرابط.`
          : `استجابة المتجر غير صالحة أو لم يتم إرجاع قائمة طلبات. يرجى التأكد من رابط المتجر وصلاحية المفاتيح.`;
        return res.status(200).json({ 
          success: false, 
          count: 0,
          orders: [],
          message: customMsg 
        });
      }

      const orders = parsedData;

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

      res.status(200).json({ success: true, count: mappedOrders.length, orders: mappedOrders });
    } catch (error: any) {
      console.error("Error syncing with WooCommerce:", error);
      res.status(200).json({ 
        success: false, 
        count: 0,
        orders: [],
        message: error.name === 'TimeoutError' 
          ? 'انتهى وقت الاتصال بالمتجر (Timeout). يرجى التحقق من سرعة الخادم في متجرك.' 
          : 'خطأ أثناء الاتصال بمتجرك: ' + (error.message || 'Unknown error') 
      });
    }
  });


  app.post("/api/woocommerce/product", async (req, res) => {
    try {
      const { storeUrl, consumerKey, consumerSecret, productId } = req.body;
      
      if (!storeUrl || !consumerKey || !consumerSecret || !productId) {
        return res.status(200).json({ success: false, message: "Missing credentials or productId" });
      }

      const cleanStoreUrl = String(storeUrl).trim().replace(/\/+$/, '');

      const wooRes = await fetchWooCommerce(cleanStoreUrl, `products/${productId}`, consumerKey.trim(), consumerSecret.trim());
      const responseText = await wooRes.text().catch(() => "");
      const { data: product, isHtml, isValid } = parseWooCommerceJson(responseText);

      if (!wooRes.ok || isHtml || !isValid || !product) {
        const errorMsg = isHtml 
          ? 'المتجر أعاد صفحة ويب (HTML) بدلاً من بيانات المنتج'
          : (product?.message || `فشل جلب المنتج. المتجر رد بالرمز (${wooRes.status})`);
        return res.status(200).json({ 
          success: false, 
          message: errorMsg 
        });
      }
      
      // Fetch variations if any
      let variations = [];
      if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
         const varsRes = await fetchWooCommerce(cleanStoreUrl, `products/${productId}/variations`, consumerKey.trim(), consumerSecret.trim(), {
           per_page: 100
         });
         if (varsRes.ok) {
           const varsText = await varsRes.text().catch(() => "");
           const { data: varsData } = parseWooCommerceJson(varsText);
           if (Array.isArray(varsData)) variations = varsData;
         }
      }

      return res.json({
        success: true,
        product,
        variations
      });
    } catch (error: any) {
      console.error('API /woocommerce/product Error:', error);
      return res.status(200).json({ 
        success: false, 
        message: 'خطأ أثناء الاتصال بمتجرك: ' + (error.message || 'Unknown error') 
      });
    }
  });
  app.post("/api/woocommerce/products", async (req, res) => {
    try {
      const { storeUrl, consumerKey, consumerSecret } = req.body;
      
      if (!storeUrl || !consumerKey || !consumerSecret) {
        return res.status(200).json({ success: false, count: 0, products: [], message: "Missing credentials" });
      }

      const cleanStoreUrl = String(storeUrl).trim().replace(/\/+$/, '');

      const wooRes = await fetchWooCommerce(cleanStoreUrl, "products", consumerKey.trim(), consumerSecret.trim(), {
        per_page: 100
      });

      const responseText = await wooRes.text().catch(() => "");
      const { data: productsData, isHtml, isValid } = parseWooCommerceJson(responseText);

      if (!wooRes.ok || isHtml || !isValid || !Array.isArray(productsData)) {
        const errMsg = isHtml 
          ? 'المتجر أعاد صفحة ويب (HTML) بدلاً من بيانات المنتجات' 
          : `فشل جلب المنتجات. المتجر رد بالرمز (${wooRes.status})`;
        return res.status(200).json({ 
          success: false, 
          count: 0,
          products: [],
          message: errMsg 
        });
      }

      // We might need to fetch variations for variable products
      const mappedProducts = await Promise.all(productsData.map(async (p: any) => {
         let variations = [];
         
         if (p.type === 'variable' && p.variations && p.variations.length > 0) {
            const varRes = await fetchWooCommerce(cleanStoreUrl, `products/${p.id}/variations`, consumerKey.trim(), consumerSecret.trim(), {
               per_page: 100
            });
            if (varRes.ok) {
               const varText = await varRes.text().catch(() => "");
               const { data: vData } = parseWooCommerceJson(varText);
               if (Array.isArray(vData)) variations = vData;
            }
         }

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
            variations: (variations || []).map((v: any, idx: number) => {
               const vCost = extractCostFromMeta(v.meta_data);
               const rawVWeight = v.weight !== undefined && v.weight !== null && v.weight !== '' ? parseFloat(String(v.weight).replace(/,/g, '.')) : undefined;
               const vWeight = typeof rawVWeight === 'number' && !isNaN(rawVWeight) ? rawVWeight : productWeight;
               return {
                  id: String(v.id),
                  sku: v.sku || '',
                  name: v.attributes?.map((a: any) => a.option).join(' - ') || `تفرع ${idx + 1}`,
                  price: Number(v.price || 0),
                  regular_price: v.regular_price || undefined,
                  sale_price: v.sale_price || undefined,
                  local_cost: vCost > 0 ? vCost : (productCost > 0 ? productCost : undefined),
                  weight: vWeight,
                  manage_stock: v.manage_stock ?? false,
                  stock_quantity: v.stock_quantity !== null && v.stock_quantity !== undefined ? Number(v.stock_quantity) : 0,
                  stock_status: v.stock_status || 'instock',
                  attributes: v.attributes || []
               };
            })
         };
      }));

      res.status(200).json({ success: true, count: mappedProducts.length, products: mappedProducts });
    } catch (error: any) {
      console.error("Error syncing products:", error);
      res.status(500).json({ 
        success: false, 
        message: error.name === 'TimeoutError' 
          ? 'انتهى وقت الاتصال بالمتجر (Timeout)' 
          : 'خطأ أثناء الاتصال بمتجرك: ' + (error.message || 'Unknown error') 
      });
    }
  });

  app.post("/api/shipping/ecotrack/create", async (req, res) => {
    try {
      const { domain, token, order } = req.body;
      
      if (!domain || !token || !order) {
        return res.status(400).json({ success: false, message: "Missing credentials or order data" });
      }

      let baseUrl = domain.replace(/\/$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
      }
      const url = `${baseUrl}/api/v1/create/order`;
      
      const defaultCommunes: Record<number, string> = {
        1: "Adrar", 2: "Chlef", 3: "Laghouat", 4: "Oum El Bouaghi", 5: "Batna", 6: "Bejaia", 7: "Biskra", 8: "Bechar", 9: "Blida", 10: "Bouira",
        11: "Tamanrasset", 12: "Tebessa", 13: "Tlemcen", 14: "Tiaret", 15: "Tizi Ouzou", 16: "Alger Centre", 17: "Djelfa", 18: "Jijel", 19: "Setif", 20: "Saida",
        21: "Skikda", 22: "Sidi Bel Abbes", 23: "Annaba", 24: "Guelma", 25: "Constantine", 26: "Medea", 27: "Mostaganem", 28: "M'Sila", 29: "Mascara", 30: "Ouargla",
        31: "Oran", 32: "El Bayadh", 33: "Illizi", 34: "Bordj Bou Arreridj", 35: "Boumerdes", 36: "El Tarf", 37: "Tindouf", 38: "Tissemsilt", 39: "El Oued", 40: "Khenchela",
        41: "Souk Ahras", 42: "Tipaza", 43: "Mila", 44: "Ain Defla", 45: "Naama", 46: "Ain Temouchent", 47: "Ghardaia", 48: "Relizane",
        49: "Timimoun", 50: "Bordj Badji Mokhtar", 51: "Ouled Djellal", 52: "Beni Abbes", 53: "In Salah", 54: "In Guezzam", 55: "Touggourt", 56: "Djanet", 57: "El M'Ghair", 58: "El Meniaa"
      };

      const arabicToFrenchCommunes: Record<string, string> = {
        // Tamanrasset
        "تمنراست": "Tamanrasset", "تامنراست": "Tamanrasset", "تمنرست": "Tamanrasset", "تمنغاست": "Tamanrasset",
        "أباليسا": "Abalessa", "اباليسا": "Abalessa", "أبالسة": "Abalessa", "ابالسة": "Abalessa",
        "عين أمقل": "Ain Amguel", "عين امقل": "Ain Amguel", "إدلس": "Idles", "ادلس": "Idles", "تاظروك": "Tazrouk",
        // Other Wilaya Capitals & Common Arabic names
        "أدرار": "Adrar", "ادرار": "Adrar", "الشلف": "Chlef", "شلف": "Chlef",
        "الأغواط": "Laghouat", "الاغواط": "Laghouat", "أم البواقي": "Oum El Bouaghi", "ام البواقي": "Oum El Bouaghi",
        "باتنة": "Batna", "بجاية": "Bejaia", "بسكرة": "Biskra", "بشار": "Bechar",
        "البليدة": "Blida", "بليدة": "Blida", "البويرة": "Bouira", "بويرة": "Bouira",
        "تبسة": "Tebessa", "تلمسان": "Tlemcen", "تيارت": "Tiaret", "تيزي وزو": "Tizi Ouzou", "تيزيوزو": "Tizi Ouzou",
        "الجزائر": "Alger Centre", "الجزائر العاصمة": "Alger Centre", "الجزائر وسط": "Alger Centre",
        "الجلفة": "Djelfa", "جلفة": "Djelfa", "جيجل": "Jijel", "سطيف": "Setif", "سعيدة": "Saida",
        "سكيكدة": "Skikda", "سيدي بلعباس": "Sidi Bel Abbes", "عنابة": "Annaba", "قالمة": "Guelma",
        "قسنطينة": "Constantine", "المدية": "Medea", "مدية": "Medea", "مستغانم": "Mostaganem",
        "المسيلة": "M'Sila", "مسيلة": "M'Sila", "معسكر": "Mascara", "ورقلة": "Ouargla", "وهران": "Oran",
        "البيض": "El Bayadh", "إيليزي": "Illizi", "ايليزي": "Illizi", "برج بوعريريج": "Bordj Bou Arreridj",
        "بومرداس": "Boumerdes", "الطارف": "El Tarf", "طارف": "El Tarf", "تندوف": "Tindouf",
        "تيسمسيلت": "Tissemsilt", "الوادي": "El Oued", "وادي": "El Oued", "خنشلة": "Khenchela",
        "سوق أهراس": "Souk Ahras", "سوق اهراس": "Souk Ahras", "تيبازة": "Tipaza", "ميلة": "Mila",
        "عين الدفلى": "Ain Defla", "النعامة": "Naama", "نعامة": "Naama", "عين تموشنت": "Ain Temouchent",
        "غرداية": "Ghardaia", "غليزان": "Relizane", "تيميمون": "Timimoun", "برج باجي مختار": "Bordj Badji Mokhtar",
        "أولاد جلال": "Ouled Djellal", "اولاد جلال": "Ouled Djellal", "بني عباس": "Beni Abbes",
        "عين صالح": "In Salah", "إن صالح": "In Salah", "ان صالح": "In Salah",
        "عين قزام": "In Guezzam", "إن قزام": "In Guezzam", "ان قزام": "In Guezzam",
        "تقرت": "Touggourt", "جانت": "Djanet", "المغير": "El M'Ghair", "مغير": "El M'Ghair",
        "المنيعة": "El Meniaa", "منيعة": "El Meniaa"
      };

      const wilayasNames = [
        "adrar", "chlef", "laghouat", "oum el bouaghi", "batna", "bejaia", "biskra", "bechar", "blida", "bouira",
        "tamanrasset", "tebessa", "tlemcen", "tiaret", "tizi ouzou", "alger", "djelfa", "jijel", "setif", "saida",
        "skikda", "sidi bel abbes", "annaba", "guelma", "constantine", "medea", "mostaganem", "msila", "mascara", "ouargla",
        "oran", "el bayadh", "illizi", "bordj bou arreridj", "boumerdes", "el tarf", "tindouf", "tissemsilt", "el oued", "khenchela",
        "souk ahras", "tipaza", "mila", "ain defla", "naama", "ain temouchent", "ghardaia", "relizane", "timimoun", "bordj badji mokhtar",
        "ouled djellal", "beni abbes", "in salah", "in guezzam", "touggourt", "djanet", "el mghair", "el meniaa",
        "أدرار", "الشلف", "الأغواط", "أم البواقي", "باتنة", "بجاية", "بسكرة", "بشار", "البليدة", "البويرة",
        "تمنراست", "تبسة", "تلمسان", "تيارت", "تيزي وزو", "الجزائر", "الجلفة", "جيجل", "سطيف", "سعيدة",
        "سكيكدة", "سيدي بلعباس", "عنابة", "قالمة", "قسنطينة", "المدية", "مستغانم", "المسيلة", "معسكر", "ورقلة",
        "وهران", "البيض", "إيليزي", "برج بوعريريج", "بومرداس", "الطارف", "تندوف", "تيسمسيلت", "الوادي", "خنشلة",
        "سوق أهراس", "تيبازة", "ميلة", "عين الدفلى", "النعامة", "عين تموشنت", "غرداية", "غليزان", "تيميمون", "برج باجي مختار",
        "أولاد جلال", "بني عباس", "عين صالح", "عين قزام", "تقرت", "جانت", "المغير", "المنيعة"
      ];

      // Robust Wilaya Code Extraction across region, city, address, and commune list
      let parsedWilaya = 0;
      const searchSources = [order.region, order.city, order.address].filter(Boolean) as string[];

      // 1. Look for explicit number (1-58)
      for (const src of searchSources) {
        const str = String(src).trim();
        const m = str.match(/\b([1-9]|[1-5][0-8])\b/) || str.match(/\d{1,2}/);
        if (m) {
          const val = parseInt(m[0], 10);
          if (val >= 1 && val <= 58) {
            parsedWilaya = val;
            break;
          }
        }
      }

      // 2. Look for Wilaya name string match
      if (!parsedWilaya) {
        for (const src of searchSources) {
          const r = String(src).toLowerCase();
          const idx = wilayasNames.findIndex(w => r.includes(w));
          if (idx !== -1) {
            parsedWilaya = (idx % 58) + 1;
            break;
          }
        }
      }

      // 3. Match city or address against ecotrackCommunes database
      if (!parsedWilaya && ecotrackCommunes && ecotrackCommunes.length > 0) {
        for (const src of searchSources) {
          const clean = String(src).toLowerCase().trim().replace(/[^a-z0-9]/gi, '');
          if (clean.length > 2) {
            const found = ecotrackCommunes.find((c: any) => {
              const cNom = c.nom.toLowerCase().replace(/[^a-z0-9]/gi, '');
              return cNom === clean || (cNom.length > 3 && (cNom.includes(clean) || clean.includes(cNom)));
            });
            if (found && found.wilaya_id) {
              parsedWilaya = found.wilaya_id;
              break;
            }
          }
        }
      }

      if (!parsedWilaya || parsedWilaya < 1 || parsedWilaya > 58) {
        parsedWilaya = 16; 
      }

      const method = String(order.shippingMethod || '').toLowerCase();
      let isStopDesk = method.includes('مكتب') || method.includes('stop') || method.includes('bureau') || method.includes('retrait');

      let fallbackCommune = defaultCommunes[parsedWilaya] || "Alger Centre";
      let finalCommune = "";
      
      if (ecotrackCommunes && ecotrackCommunes.length > 0) {
        const wilayaCommunes = ecotrackCommunes.filter((c: any) => c.wilaya_id === parsedWilaya);
        if (wilayaCommunes.length > 0) {
          // Determine the proper chef-lieu (wilaya capital) as default fallback
          const targetCapital = defaultCommunes[parsedWilaya] || "";
          const chefLieuMatch = wilayaCommunes.find((c: any) => 
            c.nom.toLowerCase() === targetCapital.toLowerCase() ||
            c.nom.toLowerCase().includes(targetCapital.toLowerCase()) ||
            targetCapital.toLowerCase().includes(c.nom.toLowerCase())
          );

          if (chefLieuMatch) {
            fallbackCommune = chefLieuMatch.nom;
          } else {
            const stopDeskCommune = wilayaCommunes.find((c: any) => c.has_stop_desk === 1);
            fallbackCommune = stopDeskCommune ? stopDeskCommune.nom : wilayaCommunes[0].nom;
          }
          
          let matchingCity = null;
          let communeToCheck = String(order.stopdeskCommune || order.city || '').trim();
          
          if (communeToCheck) {
            if (communeToCheck.toLowerCase().includes('ain azal') || communeToCheck.includes('عين ازال') || communeToCheck.includes('عين أزال')) {
                communeToCheck = 'Ain Azel';
            }

            // 1. Check Arabic-to-French dictionary
            for (const [arKey, frVal] of Object.entries(arabicToFrenchCommunes)) {
              if (communeToCheck.includes(arKey) || arKey.includes(communeToCheck)) {
                matchingCity = wilayaCommunes.find((c: any) => 
                  c.nom.toLowerCase() === frVal.toLowerCase() ||
                  c.nom.toLowerCase().includes(frVal.toLowerCase()) ||
                  frVal.toLowerCase().includes(c.nom.toLowerCase())
                );
                if (matchingCity) break;
              }
            }

            // 2. Direct case-insensitive match
            if (!matchingCity) {
              matchingCity = wilayaCommunes.find((c: any) => 
                c.nom.toLowerCase() === communeToCheck.toLowerCase()
              );
            }

            // 3. Substring includes match on raw text
            if (!matchingCity) {
              matchingCity = wilayaCommunes.find((c: any) => 
                communeToCheck.toLowerCase().includes(c.nom.toLowerCase()) ||
                c.nom.toLowerCase().includes(communeToCheck.toLowerCase())
              );
            }

            // 4. Normalized clean latin match
            if (!matchingCity) {
              const cityStr = communeToCheck.toLowerCase().replace(/[^a-z0-9]/gi, '');
              if (cityStr.length > 2) {
                matchingCity = wilayaCommunes.find((c: any) => {
                   const cleanNom = c.nom.toLowerCase().replace(/[^a-z0-9]/gi, '');
                   return cleanNom === cityStr || cleanNom.includes(cityStr) || cityStr.includes(cleanNom);
                });
              }
            }
          }
            
          if (matchingCity) {
             finalCommune = matchingCity.nom;
             if (isStopDesk && matchingCity.has_stop_desk === 0) {
                 const stopDeskCommune = wilayaCommunes.find((c: any) => c.has_stop_desk === 1);
                 if (stopDeskCommune) {
                     finalCommune = stopDeskCommune.nom;
                 }
             }
          } else {
             return res.status(400).json({ 
                 success: false, 
                 message: `لم يتم العثور على اسم البلدية (${communeToCheck || 'غير محددة'}) في شركة الشحن. لم يتم تمرير الطلبية لتجنب وضعها افتراضياً في عاصمة الولاية.` 
             });
          }
        }
      }

      if (!finalCommune) {
        finalCommune = fallbackCommune;
      }

      // Clean phone number: strictly digits, formatted for Algerian mobile/landline
      let cleanPhone = String(order.phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('213')) {
        cleanPhone = '0' + cleanPhone.substring(3);
      } else if (cleanPhone.length === 9 && !cleanPhone.startsWith('0')) {
        cleanPhone = '0' + cleanPhone;
      }
      if (!cleanPhone || cleanPhone.length < 9) {
        cleanPhone = "0550000000";
      }

      // Clean client name
      let cleanName = String(order.fullName || '').trim();
      if (!cleanName || cleanName.length < 2) {
        cleanName = "زبون المتجر";
      }

      // Clean product name
      let cleanProduct = "";
      if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        cleanProduct = order.items.map((it: any) => {
          const pName = String(it.name || it.productName || '').trim();
          const vName = String(it.variation || it.variationName || '').trim();
          const qty = Number(it.quantity || it.qnts || 1);
          
          let itemTitle = pName;
          if (vName && !pName.toLowerCase().includes(vName.toLowerCase())) {
            itemTitle = pName ? `${pName} (${vName})` : vName;
          } else if (!pName && vName) {
            itemTitle = vName;
          }
          return qty > 1 ? `${itemTitle} × ${qty}` : itemTitle;
        }).filter(Boolean).join(' + ');
      }

      if (!cleanProduct) {
        const pName = String(order.productName || '').trim();
        const vName = String(order.variation || '').trim();
        if (pName && vName) {
          if (vName.toLowerCase().includes(pName.toLowerCase()) || pName.toLowerCase().includes(vName.toLowerCase())) {
            cleanProduct = vName.length >= pName.length ? vName : pName;
          } else {
            cleanProduct = `${pName} ${vName}`;
          }
        } else {
          cleanProduct = pName || vName;
        }
      }

      if (!cleanProduct || cleanProduct === '-' || cleanProduct.length < 2) {
        cleanProduct = "منتج متجر";
      }

      // Clean address
      let cleanAddress = String(order.address || '').trim();
      if (!cleanAddress || cleanAddress.length < 3) {
        cleanAddress = String(`${finalCommune} - ${parsedWilaya}`).trim();
      }

      // Clean amount
      const rawPrice = order.totalCharge ?? order.totalPrice ?? order.price ?? 0;
      const cleanAmount = Number(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

      const payload = {
        reference: String(order.id).substring(0, 15), 
        nom_client: cleanName,
        telephone: cleanPhone,
        telephone_2: "",
        adresse: cleanAddress,
        commune: finalCommune,
        code_wilaya: Math.floor(parsedWilaya),
        montant: cleanAmount,
        remarque: String(order.notes || ""),
        produit: cleanProduct,
        type: 1,
        stop_desk: isStopDesk ? 1 : 0,
        weight: order.calculatedWeight ? Number(order.calculatedWeight) : 0,
        poids: order.calculatedWeight ? Number(order.calculatedWeight) : 0
      };

      const sendOrder = async (pOverride: Partial<typeof payload> = {}) => {
        const p = { ...payload, ...pOverride };
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(p)
        });
        const dataText = await resp.text();
        let data;
        try { data = JSON.parse(dataText); } catch(e) { data = { message: dataText }; }
        return { ok: resp.ok, status: resp.status, data };
      };

      let result = await sendOrder();

      // Retry 1: If stop_desk failed or stop desk unavailable, retry with stop_desk = 0 and chefLieu
      if (!result.ok && result.data && JSON.stringify(result.data).toLowerCase().includes('stop desk')) {
         const chefLieu = defaultCommunes[parsedWilaya] || fallbackCommune;
         result = await sendOrder({ commune: chefLieu, stop_desk: 0 });
      }

      // Retry 2: If commune failed, retry with chefLieu
      if (!result.ok && result.data && (JSON.stringify(result.data).toLowerCase().includes('commune') || result.status === 400)) {
         const chefLieu = defaultCommunes[parsedWilaya] || fallbackCommune;
         if (chefLieu !== finalCommune) {
            result = await sendOrder({ commune: chefLieu });
         }
      }

      // Retry 3: If duplicate reference error, append unique suffix
      if (!result.ok && result.data && (JSON.stringify(result.data).toLowerCase().includes('reference') || JSON.stringify(result.data).toLowerCase().includes('existe'))) {
         const newRef = `${payload.reference.substring(0, 12)}-${Date.now().toString().slice(-3)}`;
         result = await sendOrder({ reference: newRef });
      }

      if (!result.ok) {
        const errMessage = result.data.message || result.data.error || "خطأ في إنشاء الطلبية في منصة الشحن";
        return res.status(result.status).json({ success: false, message: errMessage, details: result.data });
      }

      let data = result.data;
      const trackingId = data.tracking || data.tracking_number || data.id || payload.reference;

      res.status(200).json({ success: true, tracking: trackingId, data });
    } catch (error) {
      console.error("Shipping API Error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/shipping/ecotrack/tracking", async (req, res) => {
    try {
      const { domain, token, trackingId } = req.body;
      if (!domain || !token || !trackingId) {
        return res.status(200).json({ success: false, message: "Missing credentials or trackingId" });
      }

      let baseUrl = domain.replace(/\/$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
      }
      
      const cleanToken = String(token || '').replace(/^Bearer\s+/i, '').trim();
      const headers = {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 COD-Master/2.0'
      };

      let url = `${baseUrl}/api/v1/get/tracking/info?tracking=${encodeURIComponent(trackingId)}`;
      
      let resp: Response;
      try {
        resp = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(12000)
        });
      } catch (fetchErr: any) {
        return res.status(200).json({
          success: false,
          isUnavailable: true,
          message: "تعذر الاتصال بخادم شركة الشحن حالياً (Service Unavailable)"
        });
      }

      if (resp.status === 404 || resp.status === 405) {
         // Fallback 1: yalidine/zr style
         url = `${baseUrl}/api/v1/tracking/info/${encodeURIComponent(trackingId)}`;
         try {
           resp = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(10000) });
           if (resp.status === 404 || resp.status === 405) {
               // Fallback 2: POST to get/tracking/info for some older ecotrack systems
               url = `${baseUrl}/api/v1/get/tracking/info`;
               resp = await fetch(url, { 
                 method: 'POST', 
                 headers, 
                 body: JSON.stringify({ tracking: trackingId, tracking_number: trackingId }),
                 signal: AbortSignal.timeout(10000)
               });
           }
         } catch {
           // ignore fallback errors
         }
      }

      if (resp.status === 503 || resp.status === 502 || resp.status === 504) {
        return res.status(200).json({
          success: false,
          isUnavailable: true,
          statusCode: resp.status,
          message: "خادم شركة الشحن غير متاح مؤقتاً (503 Service Unavailable)"
        });
      }

      if (resp.status === 429) {
        return res.status(200).json({
          success: false,
          isRateLimited: true,
          statusCode: 429,
          message: "تم تجاوز حد الطلبات لشركة الشحن مؤقتاً (Too Many Requests - 429)"
        });
      }

      const dataText = await resp.text();
      let data: any = null;
      if (dataText && !dataText.trim().startsWith('<')) {
        try { data = JSON.parse(dataText); } catch(e) { data = { message: "رد غير صالح" }; }
      } else {
        data = { message: "تعذر قراءة بيانات التتبع من شركة الشحن" };
      }

      if (!resp.ok || !data) {
        return res.status(200).json({ success: false, message: (data && data.message) || "خطأ في جلب حالة الطلبية", details: data });
      }

      res.status(200).json({ success: true, tracking: trackingId, data });
    } catch (error: any) {
      console.error("Shipping API Tracking Error:", error);
      res.status(200).json({ success: false, message: error.message || "Internal server error" });
    }
  });

  app.post("/api/shipping/ecotrack/remarks", async (req, res) => {
    try {
      const { domain, token, trackingId } = req.body;
      if (!domain || !token || !trackingId) {
        return res.status(200).json({ success: false, message: "Missing credentials or trackingId", data: [] });
      }

      let baseUrl = domain.replace(/\/$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
      }
      
      const cleanToken = String(token || '').replace(/^Bearer\s+/i, '').trim();
      const headers = {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 COD-Master/2.0'
      };

      let url = `${baseUrl}/api/v1/get/maj?tracking=${encodeURIComponent(trackingId)}`;
      
      let resp: Response;
      try {
        resp = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(10000)
        });
      } catch {
        return res.status(200).json({ success: false, isUnavailable: true, message: "خادم شركة الشحن غير متاح مؤقتاً", data: [] });
      }

      if (resp.status === 404 || resp.status === 405) {
          try {
            resp = await fetch(url, {
                method: 'POST',
                headers,
                signal: AbortSignal.timeout(10000)
            });
          } catch {}
      }

      if (resp.status === 503 || resp.status === 502 || resp.status === 504) {
        return res.status(200).json({
          success: false,
          isUnavailable: true,
          statusCode: resp.status,
          message: "خادم شركة الشحن غير متاح مؤقتاً (503 Service Unavailable)",
          data: []
        });
      }

      const dataText = await resp.text();
      let data: any = null;
      if (dataText && !dataText.trim().startsWith('<')) {
        try { data = JSON.parse(dataText); } catch(e) { data = { message: "رد غير صالح" }; }
      } else {
        data = { message: "لا تتوفر ملاحظات إضافية من نظام التتبع", data: [] };
      }

      if (!resp.ok) {
        return res.status(200).json({ success: false, message: (data && data.message) || "خطأ في جلب ملاحظات الطلبية", data: [] });
      }

      res.status(200).json({ success: true, tracking: trackingId, data });
    } catch (error: any) {
      console.error("Shipping API Remarks Error:", error);
      res.status(200).json({ success: false, message: error.message || "Internal server error", data: [] });
    }
  });

  app.post("/api/shipping/ecotrack/desks", async (req, res) => {
    try {
      const { domain, token } = req.body;
      if (!domain || !token) {
        return res.status(400).json({ success: false, message: "Missing credentials" });
      }

      let baseUrl = domain.replace(/\/+$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
      }
      let url = `${baseUrl}/api/v1/get/desks`;
      
      let resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const dataText = await resp.text();
      let data;
      try { data = JSON.parse(dataText); } catch(e) { data = { message: dataText }; }
      
      return res.status(resp.status).json({ success: resp.ok, data });
    } catch (error) {
      console.error("Shipping API Desks Error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/shipping/ecotrack/fees", async (req, res) => {
    try {
      const { domain, token } = req.body;
      if (!domain || !token) {
        return res.status(400).json({ success: false, message: "بيانات الاعتماد ناقصة (النطاق والتوكن)" });
      }

      let baseUrl = domain.replace(/\/$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
      }
      let url = `${baseUrl}/api/v1/get/fees`;

      let resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (resp.status === 404 || resp.status === 405) {
        url = `${baseUrl}/api/v1/fees`;
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
      }

      const dataText = await resp.text();
      let data;
      try { data = JSON.parse(dataText); } catch(e) { data = { message: dataText }; }

      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, message: data.message || "خطأ في جلب تسعيرة الشحن من شركة التوصيل", details: data });
      }

      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("Shipping API Fees Error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // 💬 بوابة إرسال رسائل SMS البروكسي (لحماية كلمات المرور والتوكنز)
  app.post("/api/sms/send", async (req, res) => {
    try {
      const { gateway, to, message, smsAlgerieToken, smsAlgerieSender, smsTwilioSid, smsTwilioToken, smsTwilioNumber } = req.body;

      if (!to || !message) {
        return res.status(400).json({ success: false, message: "رقم الهاتف ونص الرسالة مطلوبان" });
      }

      // تنظيف وتنسيق رقم الهاتف الجزائري
      let cleanedPhone = to.replace(/[\s\-\+\(\)]/g, '');
      if (cleanedPhone.startsWith('00213')) {
        cleanedPhone = cleanedPhone.substring(2);
      }
      if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
        cleanedPhone = '213' + cleanedPhone.substring(1);
      }
      if (cleanedPhone.length === 9 && (cleanedPhone.startsWith('5') || cleanedPhone.startsWith('6') || cleanedPhone.startsWith('7') || cleanedPhone.startsWith('9'))) {
        cleanedPhone = '213' + cleanedPhone;
      }

      if (gateway === 'twilio') {
        if (!smsTwilioSid || !smsTwilioToken || !smsTwilioNumber) {
          return res.status(400).json({ success: false, message: "معلومات بوابة Twilio غير مكتملة" });
        }

        // Twilio يحتاج صيغة E.164 مع +
        let twilioTo = cleanedPhone;
        if (!twilioTo.startsWith('+')) {
          twilioTo = '+' + twilioTo;
        }

        const auth = Buffer.from(`${smsTwilioSid}:${smsTwilioToken}`).toString('base64');
        const url = `https://api.twilio.com/2010-04-01/Accounts/${smsTwilioSid}/Messages.json`;
        const params = new URLSearchParams({
          To: twilioTo,
          From: smsTwilioNumber,
          Body: message
        });

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });

        const resText = await resp.text();
        let resData;
        try { resData = JSON.parse(resText); } catch (e) { resData = { message: resText }; }

        if (!resp.ok) {
          return res.status(resp.status).json({ success: false, message: resData.message || "فشل الإرسال عبر Twilio", details: resData });
        }

        return res.status(200).json({ success: true, messageId: resData.sid, gateway: 'twilio' });

      } else {
        // الافتراضي: SMS Algerie
        if (!smsAlgerieToken) {
          return res.status(400).json({ success: false, message: "مفتاح API أو معلومات الدخول لخدمة SMS Algerie مطلوبة" });
        }

        let url = '';
        if (smsAlgerieToken.includes(':')) {
          const [user, pass] = smsAlgerieToken.split(':');
          url = `https://www.sms-algerie.com/unicode/api/send.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&to=${encodeURIComponent(cleanedPhone)}&message=${encodeURIComponent(message)}&sender=${encodeURIComponent(smsAlgerieSender || 'SMS')}`;
        } else {
          // محاولة الإرسال باستخدام التوكن المباشر
          url = `https://www.sms-algerie.com/unicode/api/send.php?token=${encodeURIComponent(smsAlgerieToken)}&to=${encodeURIComponent(cleanedPhone)}&message=${encodeURIComponent(message)}&sender=${encodeURIComponent(smsAlgerieSender || 'SMS')}`;
        }

        const resp = await fetch(url);
        const resText = await resp.text();

        // فحص الرد من بوابة SMS Algerie
        // البوابة عادة ترجع رقم المعرف كإشارة نجاح (مثال: "123456") أو رسالة خطأ
        if (!resp.ok || resText.toLowerCase().includes('error') || resText.toLowerCase().includes('fail')) {
          return res.status(400).json({ success: false, message: `فشلت البوابة بالرد: ${resText}`, details: resText });
        }

        return res.status(200).json({ success: true, messageId: resText, gateway: 'sms_algerie' });
      }

    } catch (error: any) {
      console.error("SMS API Proxy Error:", error);
      res.status(500).json({ success: false, message: error.message || "خطأ داخلي في الخادم أثناء إرسال الرسالة" });
    }
  });

  // Global Error Handler for API & Body Parser (e.g. PayloadTooLargeError)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413 || err.name === 'PayloadTooLargeError')) {
      console.error("Payload too large error caught:", err.message);
      return res.status(413).json({
        success: false,
        message: "حجم البيانات المرسلة كبير جداً. تم ضبط الحد الأقصى حتى 50MB.",
        error: "PayloadTooLargeError"
      });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        success: false,
        message: "صيغة بيانات JSON غير صالحة.",
        error: "InvalidJSON"
      });
    }
    next(err);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
