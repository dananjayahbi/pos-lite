import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'velvetpos_offline_db';
export const CART_PERSIST_STORE = 'cart_persist';
export const SALE_QUEUE_STORE = 'sale_queue';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export async function getOfflineDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(CART_PERSIST_STORE)) {
        db.createObjectStore(CART_PERSIST_STORE, { keyPath: 'storeKey' });
      }
      if (!db.objectStoreNames.contains(SALE_QUEUE_STORE)) {
        db.createObjectStore(SALE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function saveCartSnapshot(storeKey: string, cartData: unknown): Promise<void> {
  if (!isBrowser()) return;
  const db = await getOfflineDB();
  await db.put(CART_PERSIST_STORE, { storeKey, data: cartData, savedAt: new Date().toISOString() });
}

export async function loadCartSnapshot(storeKey: string): Promise<unknown | null> {
  if (!isBrowser()) return null;
  const db = await getOfflineDB();
  const record = await db.get(CART_PERSIST_STORE, storeKey);
  return record?.data ?? null;
}

export async function clearCartSnapshot(storeKey: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await getOfflineDB();
  await db.delete(CART_PERSIST_STORE, storeKey);
}

export async function enqueueOfflineSale(payload: unknown): Promise<number> {
  const db = await getOfflineDB();
  const key = await db.add(SALE_QUEUE_STORE, { payload, queuedAt: new Date().toISOString() });
  return key as number;
}

export async function getQueuedSale(): Promise<{ key: number; payload: unknown; queuedAt: string } | null> {
  if (!isBrowser()) return null;
  const db = await getOfflineDB();
  const keys = await db.getAllKeys(SALE_QUEUE_STORE);
  if (keys.length === 0) return null;
  const firstKey = keys[0] as number;
  const record = await db.get(SALE_QUEUE_STORE, firstKey);
  if (!record) return null;
  return { key: firstKey, payload: record.payload, queuedAt: record.queuedAt };
}

export async function dequeueOfflineSale(key: number): Promise<void> {
  if (!isBrowser()) return;
  const db = await getOfflineDB();
  await db.delete(SALE_QUEUE_STORE, key);
}
