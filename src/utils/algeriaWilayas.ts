export const WILAYAS_MAP: Record<string, string> = {
  "01": "01 - أدرار (Adrar)",
  "02": "02 - الشلف (Chlef)",
  "03": "03 - الأغواط (Laghouat)",
  "04": "04 - أم البواقي (Oum El Bouaghi)",
  "05": "05 - باتنة (Batna)",
  "06": "06 - بجاية (Béjaïa)",
  "07": "07 - بسكرة (Biskra)",
  "08": "08 - بشار (Béchar)",
  "09": "09 - البليدة (Blida)",
  "10": "10 - البويرة (Bouira)",
  "11": "11 - تمنراست (Tamanrasset)",
  "12": "12 - تبسة (Tébessa)",
  "13": "13 - تلمسان (Tlemcen)",
  "14": "14 - تيارت (Tiaret)",
  "15": "15 - تيزي وزو (Tizi Ouzou)",
  "16": "16 - الجزائر (Alger)",
  "17": "17 - الجلفة (Djelfa)",
  "18": "18 - جيجل (Jijel)",
  "19": "19 - سطيف (Sétif)",
  "20": "20 - سعيدة (Saïda)",
  "21": "21 - سكيكدة (Skikda)",
  "22": "22 - سيدي بلعباس (Sidi Bel Abbès)",
  "23": "23 - عنابة (Annaba)",
  "24": "24 - قالمة (Guelma)",
  "25": "25 - قسنطينة (Constantine)",
  "26": "26 - المدية (Médéa)",
  "27": "27 - مستغانم (Mostaganem)",
  "28": "28 - المسيلة (M'Sila)",
  "29": "29 - معسكر (Mascara)",
  "30": "30 - ورقلة (Ouargla)",
  "31": "31 - وهران (Oran)",
  "32": "32 - البيض (El Bayadh)",
  "33": "33 - إليزي (Illizi)",
  "34": "34 - برج بوعريريج (Bordj Bou Arréridj)",
  "35": "35 - بومرداس (Boumerdès)",
  "36": "36 - الطارف (El Tarf)",
  "37": "37 - تندوف (Tindouf)",
  "38": "38 - تيسمسيلت (Tissemsilt)",
  "39": "39 - الوادي (El Oued)",
  "40": "40 - خنشلة (Khenchela)",
  "41": "41 - سوق أهراس (Souk Ahras)",
  "42": "42 - تيبازة (Tipaza)",
  "43": "43 - ميلة (Mila)",
  "44": "44 - عين الدفلى (Aïn Defla)",
  "45": "45 - النعامة (Naâma)",
  "46": "46 - عين تموشنت (Aïn Témouchent)",
  "47": "47 - غرداية (Ghardaïa)",
  "48": "48 - غليزان (Relizane)",
  "49": "49 - تيميمون (Timimoun)",
  "50": "50 - برج باجي مختار (Bordj Badji Mokhtar)",
  "51": "51 - أولاد جلال (Ouled Djellal)",
  "52": "52 - بني عباس (Béni Abbès)",
  "53": "53 - عين صالح (In Salah)",
  "54": "54 - عين قزام (In Guezzam)",
  "55": "55 - تقرت (Touggourt)",
  "56": "56 - جانت (Djanet)",
  "57": "57 - المغير (El M'Ghair)",
  "58": "58 - المنيعة (El Meniaa)"
};

export function formatWilaya(region: string | undefined | null): string {
  if (!region) return "-";
  
  const trimmed = region.trim();
  
  // Try matching DZ-XX or XX directly
  const match = trimmed.match(/(?:DZ-)?(\d{2})/i);
  if (match && match[1]) {
    const code = match[1];
    if (WILAYAS_MAP[code]) {
      return WILAYAS_MAP[code];
    }
  }
  
  // Try matching single digit with prepended 0 (e.g. DZ-9 -> DZ-09)
  const singleDigitMatch = trimmed.match(/(?:DZ-)?(\d{1})$/i);
  if (singleDigitMatch && singleDigitMatch[1]) {
    const code = "0" + singleDigitMatch[1];
    if (WILAYAS_MAP[code]) {
      return WILAYAS_MAP[code];
    }
  }

  // Fallback to name-based lookup
  const cleanLower = trimmed.toLowerCase();
  for (const [code, arabicLabel] of Object.entries(WILAYAS_MAP)) {
    const withoutNumber = arabicLabel.split(" - ")[1] || "";
    const englishName = withoutNumber.includes("(") ? withoutNumber.split("(")[1]?.replace(")", "")?.trim() : "";
    const arabicName = withoutNumber.split(" (")[0]?.trim();
    
    if (
      cleanLower === code ||
      cleanLower === englishName?.toLowerCase() ||
      trimmed === arabicName ||
      cleanLower.includes(englishName?.toLowerCase() || "___") ||
      trimmed.includes(arabicName || "___")
    ) {
      return arabicLabel;
    }
  }

  return region; // return as is if no match found
}
