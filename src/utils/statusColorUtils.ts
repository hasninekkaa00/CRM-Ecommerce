import { SystemSettings } from '../types';

export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  // Status 1 (Confirmation)
  'جديد': '#e0f2fe',          // أزرق سماوي ناعم
  'قيد المراجعة': '#fef3c7',  // كهرماني دافئ
  'مؤكد': '#dcfce7',          // أخضر زمردي مريح
  'ملغى': '#fee2e2',          // أحمر وردي خفيف
  'مؤجل': '#f3e8ff',          // بنفسجي هادئ
  'لا يرد': '#f1f5f9',        // رمادي محايد

  // Status 2 (Shipping & Delivery)
  'قيد التجهيز': '#e0e7ff',   // نيلي فاتح
  'تم الشحن': '#bae6fd',      // سماوي حيوي
  'في الطريق': '#cffafe',     // فيروزي فاتح
  'مستلم': '#bbf7d0',         // أخضر منعش للناجح
  'مرتجع': '#fecdd3',         // وردي محمر للمرتجع
  'قابلة للشحن': '#ede9fe',   // بنفسجي لافندر
};

export const COLOR_SWATCH_PRESETS = [
  { name: 'أخضر زمردي', hex: '#dcfce7', textHex: '#064e3b' },
  { name: 'أخضر فستقي', hex: '#bbf7d0', textHex: '#14532d' },
  { name: 'أزرق سماوي', hex: '#e0f2fe', textHex: '#0c4a6e' },
  { name: 'أزرق كلاسيكي', hex: '#dbeafe', textHex: '#1e3a8a' },
  { name: 'نيلي ملكي', hex: '#e0e7ff', textHex: '#312e81' },
  { name: 'كهرماني دافئ', hex: '#fef3c7', textHex: '#78350f' },
  { name: 'برتقالي ناعم', hex: '#ffedd5', textHex: '#7c2d12' },
  { name: 'أحمر وردي', hex: '#fee2e2', textHex: '#881337' },
  { name: 'أحمر مرجاني', hex: '#fecdd3', textHex: '#9f1239' },
  { name: 'بنفسجي لافندر', hex: '#f3e8ff', textHex: '#581c87' },
  { name: 'فيروزي مائي', hex: '#ccfbf1', textHex: '#134e4a' },
  { name: 'أصفر ليموني', hex: '#fef9c3', textHex: '#713f12' },
  { name: 'رمادي خفيف', hex: '#f1f5f9', textHex: '#1e293b' },
  { name: 'رمادي داكن', hex: '#e2e8f0', textHex: '#0f172a' },
  { name: 'أبيض ناصع', hex: '#ffffff', textHex: '#1f2937' },
];

/**
 * Returns dark readable text color for a given background hex color
 */
export function getContrastingTextColor(hexColor?: string): string {
  if (!hexColor || hexColor === 'transparent') return '#1f2937';
  
  // Clean hex
  const cleanHex = hexColor.replace('#', '');
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return '#1f2937';
  
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  }

  // Calculate luminance
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  // If color is very dark, return white, otherwise deep dark slate for high legibility
  return (yiq >= 150) ? '#0f172a' : '#ffffff';
}

/**
 * Resolves the status color and styling to paint the whole order row.
 */
export function getOrderRowColorInfo(
  order: { status1?: string; status2?: string },
  settings?: SystemSettings | null
): {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  statusUsed: string;
} {
  const customColors = settings?.statusColors || {};
  const mergedColors: Record<string, string> = {
    ...DEFAULT_STATUS_COLORS,
    ...customColors,
  };

  const mode = settings?.orderRowColorMode || 'auto';
  let chosenStatus = '';

  const s1 = (order.status1 || '').trim();
  const s2 = (order.status2 || '').trim();

  if (mode === 'status1') {
    chosenStatus = s1 || s2;
  } else if (mode === 'status2') {
    chosenStatus = s2 || s1;
  } else {
    // Mode === 'auto'
    // Priority: Significant delivery statuses take visual precedence
    const deliveryPriority = ['مرتجع', 'مستلم', 'تم الشحن', 'في الطريق', 'قيد التجهيز', 'قابلة للشحن'];
    if (s2 && deliveryPriority.includes(s2)) {
      chosenStatus = s2;
    } else if (s1) {
      chosenStatus = s1;
    } else if (s2) {
      chosenStatus = s2;
    }
  }

  const bgColor = mergedColors[chosenStatus] || '#ffffff';
  const textColor = getContrastingTextColor(bgColor);

  return {
    backgroundColor: bgColor,
    textColor,
    borderColor: bgColor === '#ffffff' ? '#f1f5f9' : 'rgba(0,0,0,0.06)',
    statusUsed: chosenStatus,
  };
}
