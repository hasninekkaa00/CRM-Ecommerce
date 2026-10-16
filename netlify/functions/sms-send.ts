export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), { 
      status: 405, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  }

  try {
    const { gateway, to, message, credentials } = await req.json();

    if (!to || !message) {
      return new Response(JSON.stringify({ success: false, message: "Missing 'to' or 'message'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    if (gateway === 'sms_algerie' || (!gateway && credentials?.smsAlgerieToken)) {
      const token = credentials?.smsAlgerieToken;
      const senderId = credentials?.smsAlgerieSenderId || '';
      
      if (!token) {
        return new Response(JSON.stringify({ success: false, message: "SMS Algerie Token is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      let cleanPhone = to.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '213' + cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith('213')) {
        cleanPhone = '213' + cleanPhone;
      }

      const params = new URLSearchParams();
      params.append('token', token);
      params.append('phone', cleanPhone);
      params.append('msg', message);
      if (senderId) params.append('sender', senderId);

      const res = await fetch(`https://api.sms-algerie.com/api/v1/send?${params.toString()}`, {
        method: 'GET'
      });
      const data = await res.json().catch(() => ({ status: res.status }));

      return new Response(JSON.stringify({ success: res.ok, data }), {
        status: res.status || 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    return new Response(JSON.stringify({ success: false, message: "Gateway not supported" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};
