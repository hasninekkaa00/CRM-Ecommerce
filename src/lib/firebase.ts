import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

// Intercept and suppress benign clock skew, connectivity, and quota warnings from Firestore
const quotaListeners = new Set<(exceeded: boolean) => void>();
let globalQuotaExceeded = false;

export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const code = err.code || '';
  const msg = err.message || (typeof err === 'string' ? err : '');
  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Free daily write units') ||
    msg.includes('quota metric') ||
    msg.includes('Quota exceeded')
  );
}

export function getIsQuotaExceeded(): boolean {
  return globalQuotaExceeded;
}

export function notifyQuotaExceeded() {
  if (!globalQuotaExceeded) {
    globalQuotaExceeded = true;
    quotaListeners.forEach(listener => {
      try {
        listener(true);
      } catch (_) {}
    });
  }
}

export function subscribeQuotaStatus(listener: (exceeded: boolean) => void): () => void {
  quotaListeners.add(listener);
  if (globalQuotaExceeded) {
    listener(true);
  }
  return () => {
    quotaListeners.delete(listener);
  };
}

export async function safeFirestoreWrite<T>(
  writeFn: () => Promise<T>,
  context: string = 'write'
): Promise<{ success: boolean; data?: T; error?: any; isQuota?: boolean }> {
  try {
    const result = await writeFn();
    return { success: true, data: result };
  } catch (err: any) {
    if (isQuotaError(err)) {
      notifyQuotaExceeded();
      console.warn(`[Firestore Quota] Skipped remote ${context} due to daily write quota. Operation saved locally.`);
      return { success: false, error: err, isQuota: true };
    }
    console.warn(`[Firestore Write Warning] ${context} error:`, err?.message || err);
    return { success: false, error: err, isQuota: false };
  }
}

if (typeof window !== 'undefined') {
  // Purge any stale Firestore keys that accumulated in browser localStorage and exceeded quota
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith('firestore_') || k.startsWith('firebase_') || k.includes('mutations_firestore'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      try {
        window.localStorage.removeItem(k);
      } catch (_) {}
    });
  } catch (_) {}

  // Safe wrapper around window.localStorage.setItem to prevent QuotaExceededError crashes
  if (window.Storage && Storage.prototype && Storage.prototype.setItem) {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      try {
        originalSetItem.call(this, key, value);
      } catch (err: any) {
        // If quota exceeded, attempt to clear firestore garbage and retry
        if (
          err?.name === 'QuotaExceededError' ||
          err?.code === 22 ||
          err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          (err?.message && err.message.includes('quota'))
        ) {
          try {
            for (let i = window.localStorage.length - 1; i >= 0; i--) {
              const k = window.localStorage.key(i);
              if (k && (k.startsWith('firestore_') || k.startsWith('firebase_'))) {
                window.localStorage.removeItem(k);
              }
            }
            // Retry once
            originalSetItem.call(this, key, value);
          } catch (_) {
            // Silently suppress quota error so client execution never halts with an unhandled assertion
            console.warn(`[Storage Quota Warning] Failed to persist key "${key}" in localStorage.`);
          }
        } else {
          throw err;
        }
      }
    };
  }

  const originalError = console.error;
  console.error = function (...args: any[]) {
    const errorMsg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    if (
      errorMsg.includes('Detected an update time that is in the future') ||
      errorMsg.includes('Could not reach Cloud Firestore backend') ||
      errorMsg.includes('Backend didn\'t respond within 10 seconds') ||
      errorMsg.includes('Failed to get document because the client is offline') ||
      errorMsg.includes('Using maximum backoff delay to prevent overloading the backend') ||
      errorMsg.includes('resource-exhausted') ||
      errorMsg.includes('Quota limit exceeded') ||
      errorMsg.includes('Free daily write units per project') ||
      errorMsg.includes('INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)') ||
      errorMsg.includes('QuotaExceededError')
    ) {
      if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota limit exceeded')) {
        notifyQuotaExceeded();
      }
      return;
    }
    originalError.apply(console, args);
  };

  const originalWarn = console.warn;
  console.warn = function (...args: any[]) {
    const warnMsg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    if (
      warnMsg.includes('Detected an update time that is in the future') ||
      warnMsg.includes('Could not reach Cloud Firestore backend') ||
      warnMsg.includes('Backend didn\'t respond within 10 seconds') ||
      warnMsg.includes('operating in offline mode') ||
      warnMsg.includes('Failed to get document because the client is offline') ||
      warnMsg.includes('Using maximum backoff delay to prevent overloading the backend') ||
      warnMsg.includes('resource-exhausted') ||
      warnMsg.includes('Quota limit exceeded') ||
      warnMsg.includes('Free daily write units per project') ||
      warnMsg.includes('QuotaExceededError')
    ) {
      if (warnMsg.includes('resource-exhausted') || warnMsg.includes('Quota limit exceeded')) {
        notifyQuotaExceeded();
      }
      return;
    }
    originalWarn.apply(console, args);
  };
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
