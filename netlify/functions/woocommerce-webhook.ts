export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), { status: 405 });
  }

  try {
    const orderData = await req.json();
    
    console.log("=========================================");
    console.log("📦 Received a webhook from WooCommerce!");
    console.log("Order ID:", orderData.id);
    console.log("Customer:", orderData.billing?.first_name, orderData.billing?.last_name);
    console.log("Total:", orderData.total);
    console.log("=========================================");
    
    const mappedOrder = {
      id: String(orderData.id),
      orderId: String(orderData.number || orderData.id),
      orderDate: orderData.date_created ? new Date(orderData.date_created).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
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
    };

    console.log("Mapped Order payload:", mappedOrder);
    
    return new Response(JSON.stringify({ success: true, message: "Order processed successfully", mappedOrder }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ success: false, message: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
