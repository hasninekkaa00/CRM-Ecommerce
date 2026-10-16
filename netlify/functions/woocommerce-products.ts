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
    const { storeUrl, consumerKey, consumerSecret } = body;
    
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return new Response(JSON.stringify({ success: false, message: "Missing credentials" }), { 
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    let baseUrl = storeUrl.trim().replace(/\/+$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }

    const authHeader = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const headerUrl = `${baseUrl}/wp-json/wc/v3/products?per_page=100`;

    let wooRes = await fetch(headerUrl, {
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
    }).catch(() => null);

    if (!wooRes || !wooRes.ok) {
      const fallbackUrl = `${baseUrl}/wp-json/wc/v3/products?per_page=100&consumer_key=${encodeURIComponent(consumerKey)}&consumer_secret=${encodeURIComponent(consumerSecret)}`;
      wooRes = await fetch(fallbackUrl, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!wooRes.ok) {
      return new Response(JSON.stringify({ success: false, message: `Failed to fetch products (${wooRes.status})` }), {
        status: wooRes.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const productsData = await wooRes.json();

    if (!Array.isArray(productsData)) {
      return new Response(JSON.stringify({ success: false, message: "Invalid data format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const mappedProducts = productsData.map((p: any) => {
      const productCost = extractCostFromMeta(p.meta_data);
      return {
        id: String(p.id),
        name: p.name,
        sku: p.sku || '',
        price: Number(p.price || 0),
        local_cost: productCost > 0 ? productCost : undefined,
        type: p.type,
        manage_stock: p.manage_stock ?? false,
        stock_quantity: p.stock_quantity !== null && p.stock_quantity !== undefined ? Number(p.stock_quantity) : 0,
        stock_status: p.stock_status || 'instock',
        image: p.images && p.images.length > 0 ? p.images[0].src : '',
        variations: (p.variations || []).map((v: any) => ({
          id: String(v.id || v),
          sku: v.sku || '',
          price: Number(v.price || 0),
          local_cost: productCost > 0 ? productCost : undefined,
          stock_quantity: v.stock_quantity !== null && v.stock_quantity !== undefined ? Number(v.stock_quantity) : 0,
          stock_status: v.stock_status || 'instock',
          attributes: v.attributes || []
        }))
      };
    });

    return new Response(JSON.stringify({ success: true, count: mappedProducts.length, products: mappedProducts }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};
