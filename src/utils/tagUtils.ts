import { Order, AbandonedOrder, OrderTag, OrderTagEntry } from '../types';

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
