'use client';

export type OutboxActionType =
  | 'VERIFY_LOTO'
  | 'START_WO'
  | 'SAVE_PROGRESS'
  | 'USE_PART'
  | 'LOG_DOWNTIME'
  | 'COMPLETE_WO'
  | 'FLAG_UNSAFE';

export interface OutboxAction {
  clientId: string;
  workOrderId: string;
  type: OutboxActionType;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'FAILED';
  attempts: number;
  lastError?: string;
  createdAt: string;
}

const DB_NAME = 'cmms_offline_db_v1';
const DB_VERSION = 1;
const STORE_OUTBOX = 'outbox';
const STORE_WO_CACHE = 'work_orders_cache';

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'clientId' });
      }
      if (!db.objectStoreNames.contains(STORE_WO_CACHE)) {
        db.createObjectStore(STORE_WO_CACHE, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function enqueueOfflineAction(input: {
  clientId?: string;
  workOrderId: string;
  type: OutboxActionType;
  payload: Record<string, unknown>;
}): Promise<OutboxAction> {
  const item: OutboxAction = {
    clientId:
      input.clientId ??
      `cli-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    workOrderId: input.workOrderId,
    type: input.type,
    payload: input.payload,
    status: 'PENDING',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    tx.objectStore(STORE_OUTBOX).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  window.dispatchEvent(new CustomEvent('cmms-outbox-changed'));
  return item;
}

export async function listOutboxActions(): Promise<OutboxAction[]> {
  try {
    const db = await openOfflineDb();
    return await new Promise<OutboxAction[]>((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readonly');
      const req = tx.objectStore(STORE_OUTBOX).getAll();
      req.onsuccess = () => {
        const list = (req.result as OutboxAction[]) ?? [];
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeOutboxAction(clientId: string): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    tx.objectStore(STORE_OUTBOX).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  window.dispatchEvent(new CustomEvent('cmms-outbox-changed'));
}

export async function markOutboxActionFailed(
  clientId: string,
  errorMsg: string,
): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    const store = tx.objectStore(STORE_OUTBOX);
    const getReq = store.get(clientId);
    getReq.onsuccess = () => {
      const existing = getReq.result as OutboxAction | undefined;
      if (existing) {
        store.put({
          ...existing,
          status: 'FAILED',
          attempts: existing.attempts + 1,
          lastError: errorMsg,
        });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  window.dispatchEvent(new CustomEvent('cmms-outbox-changed'));
}

export async function syncOutboxWithServer(): Promise<{
  synced: number;
  failed: number;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const actions = await listOutboxActions();
  if (actions.length === 0) {
    return { synced: 0, failed: 0 };
  }

  try {
    const res = await fetch('/api/v1/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions }),
    });

    if (!res.ok) {
      return { synced: 0, failed: actions.length };
    }

    const body = (await res.json()) as {
      results: Array<{ clientId: string; ok: boolean; error?: string }>;
    };

    let synced = 0;
    let failed = 0;

    for (const r of body.results ?? []) {
      if (r.ok) {
        await removeOutboxAction(r.clientId);
        synced += 1;
      } else {
        await markOutboxActionFailed(r.clientId, r.error ?? 'خطای سرور در همگام‌سازی');
        failed += 1;
      }
    }

    return { synced, failed };
  } catch {
    return { synced: 0, failed: 0 };
  }
}

export async function cacheWorkOrderOffline(wo: { id: string } & Record<string, unknown>) {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_WO_CACHE, 'readwrite');
      tx.objectStore(STORE_WO_CACHE).put({
        ...wo,
        cachedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore storage errors
  }
}

export function registerPwaServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }
}
