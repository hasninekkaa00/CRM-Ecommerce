import ecotrackCommunesData from '../ecotrack-communes.json';

const ecotrackCommunes: any[] = (ecotrackCommunesData as any[]) || [];

export const DEFAULT_WILAYA_COMMUNES: Record<number, string> = {
  1: "Adrar", 2: "Chlef", 3: "Laghouat", 4: "Oum El Bouaghi", 5: "Batna", 6: "Bejaia", 7: "Biskra", 8: "Bechar", 9: "Blida", 10: "Bouira",
  11: "Tamanrasset", 12: "Tebessa", 13: "Tlemcen", 14: "Tiaret", 15: "Tizi Ouzou", 16: "Alger Centre", 17: "Djelfa", 18: "Jijel", 19: "Setif", 20: "Saida",
  21: "Skikda", 22: "Sidi Bel Abbes", 23: "Annaba", 24: "Guelma", 25: "Constantine", 26: "Medea", 27: "Mostaganem", 28: "M'Sila", 29: "Mascara", 30: "Ouargla",
  31: "Oran", 32: "El Bayadh", 33: "Illizi", 34: "Bordj Bou Arreridj", 35: "Boumerdes", 36: "El Tarf", 37: "Tindouf", 38: "Tissemsilt", 39: "El Oued", 40: "Khenchela",
  41: "Souk Ahras", 42: "Tipaza", 43: "Mila", 44: "Ain Defla", 45: "Naama", 46: "Ain Temouchent", 47: "Ghardaia", 48: "Relizane",
  49: "Timimoun", 50: "Bordj Badji Mokhtar", 51: "Ouled Djellal", 52: "Beni Abbes", 53: "In Salah", 54: "In Guezzam", 55: "Touggourt", 56: "Djanet", 57: "El M'Ghair", 58: "El Meniaa"
};

export const ARABIC_TO_FRENCH_COMMUNES: Record<string, string> = {
  "تمنراست": "Tamanrasset", "تامنراست": "Tamanrasset", "تمنرست": "Tamanrasset", "تمنغاست": "Tamanrasset",
  "أباليسا": "Abalessa", "اباليسا": "Abalessa", "أبالسة": "Abalessa", "ابالسة": "Abalessa",
  "عين أمقل": "Ain Amguel", "عين امقل": "Ain Amguel", "إدلس": "Idles", "ادلس": "Idles", "تاظروك": "Tazrouk",
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
  "الطارف": "El Tarf", "طارف": "El Tarf", "تندوف": "Tindouf",
  "تيسمسيلت": "Tissemsilt", "الوادي": "El Oued", "وادي": "El Oued", "خنشلة": "Khenchela",
  "سوق أهراس": "Souk Ahras", "سوق اهراس": "Souk Ahras", "تيبازة": "Tipaza", "ميلة": "Mila",
  "عين الدفلى": "Ain Defla", "النعامة": "Naama", "نعامة": "Naama", "عين تموشنت": "Ain Temouchent",
  "غرداية": "Ghardaia", "غليزان": "Relizane", "تيميمون": "Timimoun", "برج باجي مختار": "Bordj Badji Mokhtar",
  "أولاد جلال": "Ouled Djellal", "اولاد جلال": "Ouled Djellal", "بني عباس": "Beni Abbes",
  "عين صالح": "In Salah", "إن صالح": "In Salah", "ان صالح": "In Salah",
  "عين قزام": "In Guezzam", "إن قزام": "In Guezzam", "ان قزام": "In Guezzam",
  "جانت": "Djanet", "المغير": "El M'Ghair", "مغير": "El M'Ghair",
  "المنيعة": "El Meniaa", "منيعة": "El Meniaa",
  "حاسي مسعود": "Hassi Messaoud", "الرويبة": "Rouiba",
  "بوفاريك": "Boufarik", "العلمة": "El Eulma", "بئر العاتر": "Bir El Ater",
  "عين وسارة": "Ain Oussera", "بريكة": "Barika", "حاسي بحبح": "Hassi Bahbah",
  "بئر الجير": "Bir El Djir", "الشراقة": "Cheraga", "عزابة": "Azzaba",
  "الرغاية": "Reghaia", "عين البيضاء": "Ain Beida", "باب الزوار": "Bab Ezzouar",
  "بوينان": "Bouinan", "قصر البخاري": "Ksar El Boukhari",
  "مغنية": "Maghnia", "المشرية": "Mecheria", "سيق": "Sig",
  "تنس": "Tenes", "بئر توتة": "Bir Touta", "براقي": "Baraki", "وادي رهيو": "Oued Rhiou"

};

export const WILAYAS_NAMES_LIST = [
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

export function extractWilayaAndCommune(order: any) {
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
      const idx = WILAYAS_NAMES_LIST.findIndex(w => r.includes(w));
      if (idx !== -1) {
        parsedWilaya = (idx % 58) + 1;
        break;
      }
    }
  }

  // 3. Match against ecotrackCommunes database
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
  const isStopDesk = method.includes('مكتب') || method.includes('stop') || method.includes('bureau') || method.includes('retrait');

  let fallbackCommune = DEFAULT_WILAYA_COMMUNES[parsedWilaya] || "Alger Centre";
  let finalCommune = "";
  let communeNotFound = false;
  let communeToCheck = "";

  if (ecotrackCommunes && ecotrackCommunes.length > 0) {
    const wilayaCommunes = ecotrackCommunes.filter((c: any) => c.wilaya_id === parsedWilaya);
    if (wilayaCommunes.length > 0) {
      const targetCapital = DEFAULT_WILAYA_COMMUNES[parsedWilaya] || "";
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
      communeToCheck = String(order.stopdeskCommune || order.city || '').trim();

      if (communeToCheck) {
        if (communeToCheck.toLowerCase().includes('ain azal') || communeToCheck.includes('عين ازال') || communeToCheck.includes('عين أزال')) {
          communeToCheck = 'Ain Azel';
        }

        
        // 1. Direct case-insensitive match
        matchingCity = wilayaCommunes.find((c: any) => 
           c.nom.toLowerCase() === communeToCheck.toLowerCase()
        );

        // 2. Check if it strictly maps to Arabic Wilaya names
        if (!matchingCity) {
            for (const [arKey, frVal] of Object.entries(ARABIC_TO_FRENCH_COMMUNES)) {
              const cleanCommune = communeToCheck.replace(/\s+/g, '');
              const cleanArKey = arKey.replace(/\s+/g, '');
              if (cleanCommune === cleanArKey || cleanCommune === cleanArKey.replace(/^ال/, '')) {
                matchingCity = wilayaCommunes.find((c: any) => 
                  c.nom.toLowerCase() === frVal.toLowerCase() ||
                  c.nom.toLowerCase().includes(frVal.toLowerCase()) ||
                  frVal.toLowerCase().includes(c.nom.toLowerCase())
                );
                if (matchingCity) break;
              }
            }
        }
        
        // 3. Normalized exact clean latin match
        if (!matchingCity) {
            const cityStr = communeToCheck.toLowerCase().replace(/[^a-z0-9]/gi, '');
            if (cityStr.length > 2) {
                matchingCity = wilayaCommunes.find((c: any) => {
                  const cleanNom = c.nom.toLowerCase().replace(/[^a-z0-9]/gi, '');
                  return cleanNom === cityStr;
                });
            }
        }
        
        // 4. Substring match (commune name contains the other)
        if (!matchingCity) {
            const cityStr = communeToCheck.toLowerCase().replace(/[^a-z0-9]/gi, '');
            if (cityStr.length > 3) { 
                matchingCity = wilayaCommunes.find((c: any) => {
                  const cleanNom = c.nom.toLowerCase().replace(/[^a-z0-9]/gi, '');
                  return cityStr.includes(cleanNom) || cleanNom.includes(cityStr);
                });
            }
        }
        
        // 5. Similarity match (Levenshtein distance)
        if (!matchingCity) {
          const cityStr = communeToCheck.toLowerCase().replace(/[^a-z0-9]/gi, '');
          if (cityStr.length > 3) {
            let bestMatch = null;
            let bestDist = Infinity;
            
            for (const c of wilayaCommunes) {
               const cleanNom = c.nom.toLowerCase().replace(/[^a-z0-9]/gi, '');
               if (cleanNom.length > 3) {
                   // Calculate distance
                   const a = cityStr;
                   const b = cleanNom;
                   let matrix = [];
                   for (let i = 0; i <= b.length; i++) matrix[i] = [i];
                   for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
                   for (let i = 1; i <= b.length; i++) {
                     for (let j = 1; j <= a.length; j++) {
                       if (b.charAt(i - 1) == a.charAt(j - 1)) {
                         matrix[i][j] = matrix[i - 1][j - 1];
                       } else {
                         matrix[i][j] = Math.min(
                           matrix[i - 1][j - 1] + 1,
                           Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                         );
                       }
                     }
                   }
                   const dist = matrix[b.length][a.length];
                   if (dist < bestDist) {
                       bestDist = dist;
                       bestMatch = c;
                   }
               }
            }
            // If distance is small enough compared to length (e.g. 1 or 2 mistakes allowed for 5+ characters)
            if (bestMatch && bestDist <= 2 && (cityStr.length >= 4 || bestDist <= 1)) {
                matchingCity = bestMatch;
            }
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
        communeNotFound = true;
        if (isStopDesk) {
          const stopDeskCommune = wilayaCommunes.find((c: any) => c.has_stop_desk === 1);
          finalCommune = stopDeskCommune ? stopDeskCommune.nom : fallbackCommune;
        } else {
          finalCommune = fallbackCommune;
        }
      }
    }
  }

  if (!finalCommune) {
    finalCommune = fallbackCommune;
  }

  return {
    wilaya: parsedWilaya,
    commune: finalCommune,
    fallbackCommune,
    isStopDesk,
    communeNotFound,
    originalCommune: communeToCheck
  };
}

export function buildEcoTrackPayload(order: any) {
  const { wilaya, commune, isStopDesk } = extractWilayaAndCommune(order);

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

  let cleanName = String(order.fullName || '').trim();
  if (!cleanName || cleanName.length < 2) {
    cleanName = "زبون المتجر";
  }

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
        cleanProduct = `${pName} (${vName})`;
      }
    } else {
      cleanProduct = pName || vName;
    }
  }

  if (!cleanProduct || cleanProduct === '-' || cleanProduct.length < 2) {
    cleanProduct = "منتج متجر";
  }

  let cleanAddress = String(order.address || '').trim();
  if (!cleanAddress || cleanAddress.length < 3) {
    cleanAddress = String(`${commune} - ${wilaya}`).trim();
  }

  const rawPrice = order.totalCharge ?? order.totalPrice ?? order.price ?? 0;
  const cleanAmount = Number(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

  return {
    reference: String(order.id).substring(0, 15),
    nom_client: cleanName,
    telephone: cleanPhone,
    telephone_2: "",
    adresse: cleanAddress,
    commune: commune,
    code_wilaya: Math.floor(wilaya),
    montant: cleanAmount,
    remarque: String(order.notes || ""),
    produit: cleanProduct,
    type: 1,
    stop_desk: isStopDesk ? 1 : 0,
    weight: order.calculatedWeight ? Number(order.calculatedWeight) : 0,
    poids: order.calculatedWeight ? Number(order.calculatedWeight) : 0
  };
}

/**
 * Universal Shipping Order Creator
 * First attempts server endpoint (`/api/shipping/ecotrack/create`).
 * If running on a static host (like Netlify) where `/api` returns HTML (index.html),
 * it immediately executes the request directly in the browser with CORS proxy fallback.
 */
export async function createShippingOrder(
  order: any, 
  integration: { domain?: string; token?: string; name?: string }
): Promise<{ success: boolean; tracking?: string; message?: string; data?: any; details?: any }> {
  if (!integration || !integration.token) {
    return { success: false, message: 'مفتاح الربط (Token) غير متوفر لشركة الشحن.' };
  }

  const cleanDomain = (integration.domain || 'https://expedigo.ecotrack.dz').replace(/\/+$/, '');
  const targetDomain = cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://') 
    ? cleanDomain 
    : `https://${cleanDomain}`;

  // 1. First attempt: call local backend / netlify function
  try {
    const res = await fetch('/api/shipping/ecotrack/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: targetDomain,
        token: integration.token,
        order: order
      })
    });

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    // Check if the response is actually valid JSON and NOT an HTML fallback from Netlify/SPA
    if (contentType.includes('application/json') || (!text.trim().startsWith('<') && !text.includes('<!doctype') && !text.includes('<html'))) {
      try {
        const json = JSON.parse(text);
        if (json && typeof json === 'object') {
          return json;
        }
      } catch (e) {
        // Fallback to client-side direct request
      }
    }
  } catch (e) {
    console.warn('[Shipping API] Local endpoint unavailable or failed, switching to direct client-side execution...');
  }

  // 2. Client-Side Direct Execution & Proxy Fallback
  return await executeDirectEcoTrackCreate(order, targetDomain, integration.token);
}

/**
 * Direct EcoTrack creation from the browser with CORS fallback
 */
async function executeDirectEcoTrackCreate(
  order: any, 
  targetDomain: string, 
  token: string
): Promise<{ success: boolean; tracking?: string; message?: string; data?: any; details?: any }> {
  const { wilaya, fallbackCommune, communeNotFound, originalCommune } = extractWilayaAndCommune(order);
  if (communeNotFound) {
      return {
          success: false,
          message: `لم يتم العثور على اسم البلدية (${originalCommune || 'غير محددة'}) في شركة الشحن. لم يتم تمرير الطلبية.`
      };
  }
  const payload = buildEcoTrackPayload(order);
  const apiUrl = `${targetDomain}/api/v1/create/order`;

  const trySend = async (pOverride: Partial<typeof payload> = {}, useCorsProxy = false): Promise<{ ok: boolean; status: number; data: any }> => {
    const p = { ...payload, ...pOverride };
    
    let fetchUrl = apiUrl;
    let headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (useCorsProxy) {
      // Use public CORS proxy fallback
      fetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
    }

    try {
      const resp = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(p)
      });
      const dataText = await resp.text();
      let data;
      try { 
        data = JSON.parse(dataText); 
      } catch(e) { 
        data = { message: dataText }; 
      }
      return { ok: resp.ok, status: resp.status, data };
    } catch (err: any) {
      if (!useCorsProxy) {
        // Retry with CORS proxy
        return await trySend(pOverride, true);
      }
      return { ok: false, status: 500, data: { message: `خطأ اتصال: ${err.message || err}` } };
    }
  };

  let result = await trySend();

  // Retry 1: If stop_desk failed or stop desk unavailable, retry with stop_desk = 0 and chefLieu
  if (!result.ok && result.data && JSON.stringify(result.data).toLowerCase().includes('stop desk')) {
    const chefLieu = DEFAULT_WILAYA_COMMUNES[wilaya] || fallbackCommune;
    result = await trySend({ commune: chefLieu, stop_desk: 0 });
  }

  // Retry 2: If commune failed, retry with chefLieu
  if (!result.ok && result.data && (JSON.stringify(result.data).toLowerCase().includes('commune') || result.status === 400)) {
    const chefLieu = DEFAULT_WILAYA_COMMUNES[wilaya] || fallbackCommune;
    if (chefLieu !== payload.commune) {
      result = await trySend({ commune: chefLieu });
    }
  }

  // Retry 3: If duplicate reference error, append unique suffix
  if (!result.ok && result.data && (JSON.stringify(result.data).toLowerCase().includes('reference') || JSON.stringify(result.data).toLowerCase().includes('existe'))) {
    const newRef = `${payload.reference.substring(0, 12)}-${Date.now().toString().slice(-3)}`;
    result = await trySend({ reference: newRef });
  }

  if (!result.ok) {
    let errMessage = result.data?.message || result.data?.error || "خطأ في إنشاء الطلبية في منصة الشحن";
    if (result.data?.errors) {
      const errs = Object.values(result.data.errors).flat().join(' | ');
      errMessage += ' - التفاصيل: ' + errs;
    }
    return { success: false, message: errMessage, details: result.data };
  }

  const data = result.data;
  const trackingId = data.tracking || data.tracking_number || (data.data && (data.data.tracking || data.data.tracking_number || data.data.id)) || payload.reference;

  return { success: true, tracking: trackingId, data };
}

/**
 * Universal Tracking Information Fetcher
 */
export async function fetchUniversalTrackingInfo(
  param1: any,
  param2: any
): Promise<{ success: boolean; data?: any; message?: string; isUnavailable?: boolean; isRateLimited?: boolean }> {
  let trackingId = typeof param1 === 'string' ? param1 : (typeof param2 === 'string' ? param2 : '');
  let integration = typeof param1 === 'object' && param1 !== null ? param1 : (typeof param2 === 'object' && param2 !== null ? param2 : {});

  if (!trackingId || !integration || !integration.token) {
    return { success: false, message: 'بيانات غير كافية لجلب حالة التتبع' };
  }

  const cleanDomain = (integration.domain || 'https://expedigo.ecotrack.dz').replace(/\/+$/, '');
  const targetDomain = cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://') 
    ? cleanDomain 
    : `https://${cleanDomain}`;

  // 1. Try local server / Netlify function first
  try {
    const res = await fetch('/api/shipping/ecotrack/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: targetDomain,
        token: integration.token,
        trackingId: trackingId
      })
    });

    if (res.status === 503 || res.status === 502 || res.status === 504) {
      return {
        success: false,
        isUnavailable: true,
        message: 'خادم شركة الشحن غير متاح مؤقتاً (503 Service Unavailable)'
      };
    }

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (contentType.includes('application/json') || (!text.trim().startsWith('<') && !text.includes('<!doctype') && !text.includes('<html'))) {
      try {
        const json = JSON.parse(text);
        if (json && typeof json === 'object') {
          // If server reported success or explicitly reported isUnavailable / isRateLimited, return it directly
          if (json.success || json.isUnavailable || json.isRateLimited) {
            return json;
          }
          if (json.message && (json.message.includes('503') || json.message.toLowerCase().includes('service unavailable'))) {
            return { success: false, isUnavailable: true, message: json.message };
          }
          return json;
        }
      } catch (e) {
        // Fallback
      }
    }
  } catch (e) {
    // Proceed to direct
  }

  // 2. Direct client-side fetch
  try {
    const directUrl = `${targetDomain}/api/v1/get/tracking/info?tracking=${encodeURIComponent(trackingId)}`;
    const cleanToken = String(integration.token || '').replace(/^Bearer\s+/i, '').trim();
    const headers = {
      'Authorization': `Bearer ${cleanToken}`,
      'Accept': 'application/json'
    };

    let resp = await fetch(directUrl, { method: 'GET', headers }).catch(() => null);
    
    if (resp && (resp.status === 503 || resp.status === 502 || resp.status === 504)) {
      return { success: false, isUnavailable: true, message: 'خادم شركة الشحن غير متاح مؤقتاً (503 Service Unavailable)' };
    }

    if (!resp || !resp.ok) {
      // Fallback via CORS proxy only if not a server-down error
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
      resp = await fetch(proxyUrl, { method: 'GET', headers }).catch(() => null);
    }

    if (resp && resp.ok) {
      const data = await resp.json();
      return { success: true, data: data.data || data };
    }

    return { success: false, message: 'تعذر جلب حالة التتبع من المنصة' };
  } catch (err: any) {
    return { success: false, message: err.message || 'خطأ في جلب التتبع' };
  }
}

/**
 * Universal Shipping Fees Fetcher
 */
let cachedDesks: Record<string, { data: any; time: number }> = {};

export async function fetchEcoTrackDesks(integration: any) {
  if (!integration || !integration.token) return null;
  const domain = (integration.domain || 'https://expedigo.ecotrack.dz').replace(/\/+$/, '');
  
  if (cachedDesks[domain] && Date.now() - cachedDesks[domain].time < 1000 * 60 * 30) {
    return cachedDesks[domain].data;
  }
  
  let targetDomain = domain.startsWith('http://') || domain.startsWith('https://') 
     ? domain 
     : `https://${domain}`;

  try {
     const res = await fetch('/api/shipping/ecotrack/desks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: targetDomain, token: integration.token })
     });
     const json = await res.json();
     if (json && json.success && json.data) {
        cachedDesks[domain] = { data: json.data, time: Date.now() };
        return json.data; // { my_desk: {...}, other_desks: [...] }
     }
  } catch (e) {
     console.error("fetchEcoTrackDesks error:", e);
  }
  return null;
}

export async function fetchUniversalShippingFees(
  integration: { domain?: string; token?: string }
): Promise<any | null> {
  if (!integration || !integration.token) return null;

  const cleanDomain = (integration.domain || 'https://expedigo.ecotrack.dz').replace(/\/+$/, '');
  const targetDomain = cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://') 
    ? cleanDomain 
    : `https://${cleanDomain}`;

  // Try local / Netlify function first
  try {
    const res = await fetch('/api/shipping/ecotrack/fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: targetDomain,
        token: integration.token
      })
    });

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (contentType.includes('application/json') || (!text.trim().startsWith('<') && !text.includes('<!doctype'))) {
      const json = JSON.parse(text);
      if (json && json.success) {
        return json.data;
      }
    }
  } catch (e) {
    // Fallback
  }

  // Direct fetch fallback
  try {
    const feesUrl = `${targetDomain}/api/v1/get/fees`;
    let resp = await fetch(feesUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${integration.token}`, 'Accept': 'application/json' }
    }).catch(() => null);

    if (!resp || !resp.ok) {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feesUrl)}`;
      resp = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${integration.token}`, 'Accept': 'application/json' }
      }).catch(() => null);
    }

    if (resp && resp.ok) {
      const json = await resp.json();
      return json.data || json;
    }
  } catch (err) {
    console.warn('[Fees API] Direct fees fetch failed');
  }

  return null;
}
