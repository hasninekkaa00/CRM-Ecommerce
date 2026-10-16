import React from 'react';
import { ViewState } from '../types';

export interface SavedLayoutView {
  id: string;
  name: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;

  // Layout & Visibility preferences
  sidebarMode: 'full' | 'mini' | 'hidden';
  sidebarViewMode: 'list' | 'grid';
  isHeaderCollapsed: boolean;
  isProductBarCollapsed: boolean;
  isSyncBarCollapsed: boolean;
  isSectionsCardCollapsed?: boolean;
  isFocusMode: boolean;

  // Navigation & Filtering
  defaultLandingView?: ViewState;
  globalProductFilter?: string;

  // Visual Theme & Appearance
  themePalette?: string;
}

export const DEFAULT_PRESET_VIEWS: SavedLayoutView[] = [
  {
    id: 'preset-standard',
    name: 'المظهر القياسي (الكامل)',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    sidebarMode: 'full',
    sidebarViewMode: 'list',
    isHeaderCollapsed: false,
    isProductBarCollapsed: false,
    isSyncBarCollapsed: false,
    isSectionsCardCollapsed: false,
    isFocusMode: false,
    themePalette: 'midnight'
  },
  {
    id: 'preset-compact-work',
    name: 'مساحة العمل الموسعة (Mini Rail)',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    sidebarMode: 'mini',
    sidebarViewMode: 'list',
    isHeaderCollapsed: true,
    isProductBarCollapsed: false,
    isSyncBarCollapsed: true,
    isSectionsCardCollapsed: true,
    isFocusMode: false,
  },
  {
    id: 'preset-zen-focus',
    name: 'وضع التركيز التام (Focus & Fill)',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    sidebarMode: 'hidden',
    sidebarViewMode: 'list',
    isHeaderCollapsed: true,
    isProductBarCollapsed: true,
    isSyncBarCollapsed: true,
    isSectionsCardCollapsed: true,
    isFocusMode: true,
  }
];

const STORAGE_KEY = 'app_saved_layout_views';
const ACTIVE_VIEW_KEY = 'app_active_layout_view_id';

export function getSavedLayoutViews(): SavedLayoutView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load saved views:', e);
  }
  return DEFAULT_PRESET_VIEWS;
}

export function saveLayoutViews(views: SavedLayoutView[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch (e) {
    console.error('Failed to persist saved views:', e);
  }
}

export function getActiveLayoutViewId(): string | null {
  return localStorage.getItem(ACTIVE_VIEW_KEY);
}

export function setActiveLayoutViewId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_VIEW_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_VIEW_KEY);
  }
}
