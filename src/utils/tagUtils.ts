import { Order, AbandonedOrder, OrderTag, OrderTagEntry } from '../types';

export const TAG_COLOR_PRESETS = [
  { name: 'زمردي أخضر', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold' },
  { name: 'أخضر هادئ', color: 'bg-green-100 text-green-800 border-green-300 font-bold' },
  { name: 'أزرق سماوي', color: 'bg-blue-100 text-blue-800 border-blue-300 font-bold' },
  { name: 'نيلي ملكي', color: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold' },
  { name: 'كهرماني VIP', color: 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold' },
  { name: 'برتقالي تحذيري', color: 'bg-orange-100 text-orange-800 border-orange-300 font-bold' },
  { name: 'أحمر عاجل', color: 'bg-red-100 text-red-800 border-red-300 font-bold' },
  { name: 'وردي لطيف', color: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' },
  { name: 'بنفسجي داكن', color: 'bg-purple-100 text-purple-800 border-purple-300 font-bold' },
  { name: 'رمادي محايد', color: 'bg-slate-100 text-slate-700 border-slate-300 font-bold' },
  { name: 'فيروزي مائي', color: 'bg-teal-100 text-teal-800 border-teal-300 font-bold' }
];

export const DEFAULT_TAGS: OrderTag[] = [
  { name: 'متروكة ناجحة', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold' },
  { name: 'طلب جديد', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { name: 'طلبية مؤكدة', color: 'bg-green-100 text-green-800 border-green-300' },
  { name: 'زبون VIP', color: 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold' },
  { name: 'لا يرد - محاولة 1', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { name: 'لا يرد - محاولة 2', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { name: 'لا يرد - محاولة 3', color: 'bg-red-100 text-red-800 border-red-300 font-bold' },
  { name: 'توصيل سريع', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { name: 'مشكلة في العنوان', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: 'طلب خاص', color: 'bg-blue-100 text-blue-800 border-blue-300' }
];

export const TAGS_OPTIONS = DEFAULT_TAGS;

export function getOrderTagsHistory(order: Order | AbandonedOrder | any, activeTagsSettings?: OrderTag[]): OrderTagEntry[] {
  if (!order) return [];
  if (order.tagsHistory && Array.isArray(order.tagsHistory) && order.tagsHistory.length > 0) {
    return order.tagsHistory;
  }
  if (order.tag && typeof order.tag === 'string' && order.tag.trim() !== '') {
    const tagObj = activeTagsSettings?.find(t => t.name === order.tag);
    return [{
      id: 'legacy-' + (order.id || Date.now()),
      name: order.tag,
      color: tagObj?.color || 'bg-indigo-50 border-indigo-200 text-indigo-700',
      createdAt: order.orderDate || new Date().toISOString(),
    }];
  }
  return [];
}

export function getLatestTag(order: Order | AbandonedOrder | any, activeTagsSettings?: OrderTag[]): OrderTagEntry | null {
  const history = getOrderTagsHistory(order, activeTagsSettings);
  if (history.length > 0) {
    return history[history.length - 1];
  }
  return null;
}

export function getLatestTagName(order: Order | AbandonedOrder | any, activeTagsSettings?: OrderTag[]): string {
  const latest = getLatestTag(order, activeTagsSettings);
  return latest ? latest.name : '';
}

export function formatTagTimestamp(isoOrDateStr: string): string {
  if (!isoOrDateStr) return '';
  try {
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) return isoOrDateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  } catch {
    return isoOrDateStr;
  }
}

export function addTagToOrder(
  order: Order | AbandonedOrder | any,
  tagName: string,
  activeTagsSettings?: OrderTag[]
): { tag: string; tagsHistory: OrderTagEntry[] } {
  const currentHistory = getOrderTagsHistory(order, activeTagsSettings);
  const tagObj = activeTagsSettings?.find(t => t.name === tagName);
  
  const now = new Date();

  const newEntry: OrderTagEntry = {
    id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: tagName,
    color: tagObj?.color || 'bg-slate-100 text-slate-700 border-slate-200',
    createdAt: now.toISOString(),
  };

  const updatedHistory = [...currentHistory, newEntry];

  return {
    tag: tagName, // Keep latest tag name synced for backward compatibility
    tagsHistory: updatedHistory,
  };
}

export function removeTagFromOrder(
  order: Order | AbandonedOrder | any,
  tagEntryId: string,
  activeTagsSettings?: OrderTag[]
): { tag: string; tagsHistory: OrderTagEntry[] } {
  const currentHistory = getOrderTagsHistory(order, activeTagsSettings);
  const updatedHistory = currentHistory.filter(t => t.id !== tagEntryId);
  const latestTag = updatedHistory.length > 0 ? updatedHistory[updatedHistory.length - 1].name : '';

  return {
    tag: latestTag,
    tagsHistory: updatedHistory,
  };
}
