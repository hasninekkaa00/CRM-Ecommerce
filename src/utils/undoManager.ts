import { Order, InventoryProduct, Expense, CampaignRecord } from '../types';
import toast from 'react-hot-toast';

export type DeletableEntityType = 'order' | 'inventory_product' | 'expense' | 'campaign_record' | 'campaign';

export interface DeletedItemRecord {
  id: string;
  entityType: DeletableEntityType;
  originalId: string;
  title: string;
  subtitle?: string;
  data: any;
  deletedAt: string;
}

const UNDO_STORAGE_KEY = 'app_deleted_items_history';
const MAX_HISTORY_ITEMS = 50;

export function getDeletedHistory(): DeletedItemRecord[] {
  try {
    const raw = localStorage.getItem(UNDO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load deleted history:', e);
  }
  return [];
}

export function saveDeletedHistory(history: DeletedItemRecord[]): void {
  try {
    localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
  } catch (e) {
    console.error('Failed to save deleted history:', e);
  }
}

export function recordDeletedItem(record: Omit<DeletedItemRecord, 'id' | 'deletedAt'>): DeletedItemRecord {
  const newRecord: DeletedItemRecord = {
    ...record,
    id: 'del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    deletedAt: new Date().toISOString()
  };

  const current = getDeletedHistory();
  const updated = [newRecord, ...current.filter(i => i.originalId !== record.originalId)];
  saveDeletedHistory(updated);
  return newRecord;
}

export function removeDeletedRecord(id: string): void {
  const current = getDeletedHistory();
  saveDeletedHistory(current.filter(i => i.id !== id));
}

export function clearAllDeletedHistory(): void {
  localStorage.removeItem(UNDO_STORAGE_KEY);
}
