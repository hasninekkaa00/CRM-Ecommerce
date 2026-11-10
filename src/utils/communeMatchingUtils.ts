import woocommerceData from '../data/woocommerceCommunes.json';
import defaultEcoCommunes from '../ecotrack-communes.json';

export interface EcoCommune {
  id?: number | string;
  nom: string;
  wilaya_id: number;
  has_stop_desk?: number | boolean;
  code_postal?: string;
}

export interface WpCommuneEntry {
  wilaya_id: number;
  wpNom: string;
  wilayaNameAr: string;
  wilayaNameFr: string;
}

export interface MatchResult {
  wpNom: string;
  wilaya_id: number;
  matchedNom: string;
  isManual: boolean;
  confidence: 'exact' | 'high' | 'medium' | 'none';
  hasStopDesk?: boolean;
}

/**
 * Standard Wilaya definitions (1 to 58)
 */
export const ALGERIA_WILAYAS: Record<number, { ar: string; fr: string }> = (woocommerceData as any).wilayas || {};

/**
 * Maps the 10 new wilayas (49-58) to their historical parent wilayas (1-48)
 * for seamless compatibility with legacy WooCommerce plugins.
 */
export const NEW_WILAYAS_PARENT_MAP: Record<number, number> = {
  49: 1,  // Timimoun -> Adrar
  50: 1,  // Bordj Badji Mokhtar -> Adrar
  51: 7,  // Ouled Djellal -> Biskra
  52: 8,  // Beni Abbes -> Bechar
  53: 11, // In Salah -> Tamanrasset
  54: 11, // In Guezzam -> Tamanrasset
  55: 30, // Touggourt -> Ouargla
  56: 33, // Djanet -> Illizi
  57: 39, // El M'Ghair -> El Oued
  58: 47  // El Meniaa -> Ghardaia
};

/**
 * Normalizes Algerian commune names for robust matching.
 * Handles abbreviations (O -> Ouled, B -> Bordj), prefixes (El, Al, Beni, Ain),
 * accents, apostrophes, and French phonetic variants.
 */
export function normalizeAlgerianName(s: any): string {
  if (!s) return '';
  let str = String(s).trim().toLowerCase();

  // Strip diacritics / accents
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Expand common Algerian abbreviations
  str = str
    .replace(/^o\s+/g, 'ouled ')
    .replace(/^b\s+/g, 'bordj ')
    .replace(/\bbeni\b/g, 'beni')
    .replace(/\bsidi\b/g, 'sidi')
    .replace(/\bain\b/g, 'ain')
    .replace(/['’\-_\s\.]/g, '') // remove spaces, dashes, apostrophes, dots
    .replace(/ou/g, 'u')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/dj/g, 'j')
    .replace(/ch/g, 'c')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'e')
    .replace(/oo/g, 'o')
    .replace(/el/g, '')
    .replace(/al/g, '');

  return str;
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
export function calcLevenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Known special mappings between WooCommerce DZ.php names and EcoTrack names
 */
export const KNOWN_SPECIAL_MAPPINGS: Record<string, string> = {
  // Adrar
  'O Ahmed Timmi': 'Ouled Ahmed Timmi',
  'Inozghmir': 'In Zghmir',
  'Timokten': 'Timekten',
  'Tamentit': 'Tamantit',
  'B Badji Mokhtar': 'Bordj Badji Mokhtar',
  'Sbaa': 'Sebaa',
  
  // Chlef
  'Abou El Hassen': 'Abou El Hassan',
  'Bouzghaia': 'Bouzeghaia',
  'Tadjna': 'Tadjena',
  'Ben Boutaleb': 'Beni Bouattab',
  'Sidi Akacha': 'Sidi Akkacha',
  
  // Laghouat
  'Hassi R Mel': 'Hassi R\'Mel',
  'Oued M Zi': 'Oued M\'Zi',
  
  // Oum El Bouaghi
  'Ainmlila': 'Ain M\'lila',
  'El Fedjoudj Boughrar': 'El Fedjoudj Boughrara',
  'Hanchir Toumghani': 'Henchir Toumghani',
  'Ain Fekroune': 'Ain Fekroun',
  
  // Batna
  'Metkaouak': 'Metkaouak (Menaa)',
  'Ouyoun El Assafir': 'Ayoun El Assafir',
  
  // Bejaia
  'Ifelain Ilmathen': 'Felaoucene Ilmaten',
  'Beni Djellil': 'Beni Dejellil',
  
  // Bechar
  'Mechraa Houari B': 'Mechraa Houari Boumedienne',
  'Tabalbala': 'Tabelbala',
  'Kenedsa': 'Kenadsa',
  
  // Bouira
  'Ath Mansour': 'Ath Mansour Taourirt',
  'Larba Nait Irathen': 'Larbaa Nath Irathen',
  'Tizi Nthlata': 'Tizi N\'tleta',
  
  // Alger
  'Hamma Anassers': 'Belouizdad',
  'Bologhine Ibn Ziri': 'Bologhine',
  'Djasr Kasentina': 'Djasr Kasentina',
  'Les Eucalyptus': 'Les Eucalyptus',
  'Khracia': 'Khraicia',
  'Baba Hassen': 'Baba Hesen',
  
  // Tiaret
  'Zmalet El Emir Aek': 'Zmalet El Emir Abdelkader',
  'Ouled Djerad': 'Ouled Djerad (Madna)',
  
  // Mascara
  'Ras Ain Amirouche': 'Ras El Ain Amirouche',
  
  // Bordj Bou Arreridj
  'Bordj Ghdir': 'Bordj Ghedir',
  
  // Boumerdes
  'Boudouaou El Bahri': 'Boudouaou El Bahri',
  'Bouzegza Keddara': 'Keddara'
};

/**
 * Returns all WordPress communes organized flat or by wilaya
 */
export function getAllWooCommerceCommunes(): WpCommuneEntry[] {
  const communesByWilaya: Record<string, string[]> = (woocommerceData as any).communesByWilaya || {};
  const entries: WpCommuneEntry[] = [];

  for (const [wStr, list] of Object.entries(communesByWilaya)) {
    const wId = parseInt(wStr, 10);
    const info = ALGERIA_WILAYAS[wId] || { ar: `ولاية ${wId}`, fr: `Wilaya ${wId}` };
    if (Array.isArray(list)) {
      for (const name of list) {
        entries.push({
          wilaya_id: wId,
          wpNom: name,
          wilayaNameAr: info.ar,
          wilayaNameFr: info.fr
        });
      }
    }
  }

  return entries;
}

/**
 * Finds the best matching EcoTrack commune for a given WooCommerce commune
 */
export function findBestEcoTrackMatch(
  wpNom: string,
  wilayaId: number,
  allEcoCommunes: EcoCommune[] = defaultEcoCommunes as EcoCommune[],
  manualMappings: Record<string, string> = {}
): { match: EcoCommune | null; confidence: 'exact' | 'high' | 'medium' | 'none'; isManual: boolean } {
  if (!wpNom) {
    return { match: null, confidence: 'none', isManual: false };
  }

  const trimmedWp = wpNom.trim();

  // 1. Check manual mapping override first
  if (manualMappings && manualMappings[trimmedWp]) {
    const mappedName = manualMappings[trimmedWp];
    const found = allEcoCommunes.find(
      e => e.nom.toLowerCase() === mappedName.toLowerCase() && 
           (e.wilaya_id === wilayaId || isRelatedWilaya(e.wilaya_id, wilayaId))
    ) || allEcoCommunes.find(e => e.nom.toLowerCase() === mappedName.toLowerCase());

    if (found) {
      return { match: found, confidence: 'exact', isManual: true };
    }
    // Even if not found in current list, treat manual mapping as authoritative
    return { 
      match: { nom: mappedName, wilaya_id: wilayaId }, 
      confidence: 'exact', 
      isManual: true 
    };
  }

  // 2. Check special known mappings dictionary
  if (KNOWN_SPECIAL_MAPPINGS[trimmedWp]) {
    const specialTarget = KNOWN_SPECIAL_MAPPINGS[trimmedWp];
    const found = allEcoCommunes.find(
      e => e.nom.toLowerCase() === specialTarget.toLowerCase()
    );
    if (found) {
      return { match: found, confidence: 'high', isManual: false };
    }
  }

  // Filter candidates: same wilaya or related new wilaya
  const candidates = allEcoCommunes.filter(
    e => e.wilaya_id === wilayaId || isRelatedWilaya(e.wilaya_id, wilayaId)
  );

  // 3. Exact case-insensitive match
  let direct = candidates.find(e => e.nom.toLowerCase() === trimmedWp.toLowerCase());
  if (direct) {
    return { match: direct, confidence: 'exact', isManual: false };
  }

  // 4. Normalized Algerian name match
  const wpNorm = normalizeAlgerianName(trimmedWp);
  let normMatch = candidates.find(e => normalizeAlgerianName(e.nom) === wpNorm);
  if (normMatch) {
    return { match: normMatch, confidence: 'high', isManual: false };
  }

  // 5. Substring / contains match
  let containsMatch = candidates.find(e => {
    const eNorm = normalizeAlgerianName(e.nom);
    return (wpNorm.length > 3 && eNorm.includes(wpNorm)) || 
           (eNorm.length > 3 && wpNorm.includes(eNorm));
  });
  if (containsMatch) {
    return { match: containsMatch, confidence: 'medium', isManual: false };
  }

  // 6. Levenshtein edit distance <= 2 on normalized string
  let bestCandidate: EcoCommune | null = null;
  let bestDist = Infinity;

  for (const c of candidates) {
    const cNorm = normalizeAlgerianName(c.nom);
    const dist = calcLevenshtein(wpNorm, cNorm);
    if (dist < bestDist && dist <= 2) {
      bestDist = dist;
      bestCandidate = c;
    }
  }

  if (bestCandidate && (wpNorm.length >= 4 || bestDist <= 1)) {
    return { match: bestCandidate, confidence: 'medium', isManual: false };
  }

  // 7. Global fallback search across all 58 wilayas
  let globalDirect = allEcoCommunes.find(e => e.nom.toLowerCase() === trimmedWp.toLowerCase());
  if (globalDirect) {
    return { match: globalDirect, confidence: 'medium', isManual: false };
  }

  let globalNorm = allEcoCommunes.find(e => normalizeAlgerianName(e.nom) === wpNorm);
  if (globalNorm) {
    return { match: globalNorm, confidence: 'medium', isManual: false };
  }

  return { match: null, confidence: 'none', isManual: false };
}

/**
 * Checks whether two wilaya IDs are related (legacy parent <-> 10 new wilayas)
 */
function isRelatedWilaya(w1: number, w2: number): boolean {
  if (w1 === w2) return true;
  if (NEW_WILAYAS_PARENT_MAP[w1] === w2) return true;
  if (NEW_WILAYAS_PARENT_MAP[w2] === w1) return true;
  return false;
}

/**
 * Resolves an order's commune name to the authoritative EcoTrack commune name
 */
export function resolveEcoTrackCommune(
  orderCommuneOrCity: string,
  wilayaId: number,
  manualMappings: Record<string, string> = {},
  cityCorrections: Record<string, string> = {},
  ecoCommunes: EcoCommune[] = defaultEcoCommunes as EcoCommune[]
): { finalNom: string; hasStopDesk: boolean; isResolved: boolean } {
  if (!orderCommuneOrCity) {
    return { finalNom: '', hasStopDesk: false, isResolved: false };
  }

  const raw = String(orderCommuneOrCity).trim();

  // 1. Manual commune mapping for this company
  if (manualMappings && manualMappings[raw]) {
    const target = manualMappings[raw];
    const ecoObj = ecoCommunes.find(e => e.nom.toLowerCase() === target.toLowerCase());
    return {
      finalNom: target,
      hasStopDesk: Boolean(ecoObj?.has_stop_desk),
      isResolved: true
    };
  }

  // 2. City corrections
  if (cityCorrections && cityCorrections[raw]) {
    const target = cityCorrections[raw];
    const ecoObj = ecoCommunes.find(e => e.nom.toLowerCase() === target.toLowerCase());
    return {
      finalNom: target,
      hasStopDesk: Boolean(ecoObj?.has_stop_desk),
      isResolved: true
    };
  }

  // 3. Best intelligent match
  const res = findBestEcoTrackMatch(raw, wilayaId, ecoCommunes, manualMappings);
  if (res.match) {
    return {
      finalNom: res.match.nom,
      hasStopDesk: Boolean(res.match.has_stop_desk),
      isResolved: true
    };
  }

  return {
    finalNom: raw,
    hasStopDesk: false,
    isResolved: false
  };
}
