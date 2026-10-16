export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), { 
      status: 405, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  }

  try {
    const body = await req.json();
    const { domain, token, order } = body;
    
    if (!domain || !token || !order) {
      return new Response(JSON.stringify({ success: false, message: "Missing credentials or order data" }), { 
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    let baseUrl = domain.replace(/\/+$/, '');
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

    let parsedWilaya = 0;
    const searchSources = [order.region, order.city, order.address].filter(Boolean) as string[];

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

    if (!parsedWilaya || parsedWilaya < 1 || parsedWilaya > 58) {
      parsedWilaya = 16;
    }

    const method = String(order.shippingMethod || '').toLowerCase();
    const isStopDesk = method.includes('مكتب') || method.includes('stop') || method.includes('bureau') || method.includes('retrait');
    const finalCommune = defaultCommunes[parsedWilaya] || "Alger Centre";

    let cleanPhone = String(order.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('213')) {
      cleanPhone = '0' + cleanPhone.substring(3);
    } else if (cleanPhone.length === 9 && !cleanPhone.startsWith('0')) {
      cleanPhone = '0' + cleanPhone;
    }
    if (!cleanPhone || cleanPhone.length < 9) {
      cleanPhone = "0550000000";
    }

    let cleanName = String(order.fullName || '').trim() || "زبون المتجر";
    let cleanProduct = String(`${order.productName || ''} ${order.variation || ''}`).trim() || "منتج متجر";
    let cleanAddress = String(order.address || '').trim() || `${finalCommune} - ${parsedWilaya}`;
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
      stop_desk: isStopDesk ? 1 : 0
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

    if (!result.ok && result.data && JSON.stringify(result.data).toLowerCase().includes('stop desk')) {
      result = await sendOrder({ stop_desk: 0 });
    }

    if (!result.ok && result.data && (JSON.stringify(result.data).toLowerCase().includes('reference') || JSON.stringify(result.data).toLowerCase().includes('existe'))) {
      const newRef = `${payload.reference.substring(0, 12)}-${Date.now().toString().slice(-3)}`;
      result = await sendOrder({ reference: newRef });
    }

    if (!result.ok) {
      const errMessage = result.data.message || result.data.error || "خطأ في إنشاء الطلبية في منصة الشحن";
      return new Response(JSON.stringify({ success: false, message: errMessage, details: result.data }), {
        status: result.status || 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const trackingId = result.data.tracking || result.data.tracking_number || (result.data.data && (result.data.data.tracking || result.data.data.id)) || payload.reference;

    return new Response(JSON.stringify({ success: true, tracking: trackingId, data: result.data }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    console.error("Netlify Shipping Error:", error);
    return new Response(JSON.stringify({ success: false, message: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};
