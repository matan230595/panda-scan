import { openDB } from './db';

export interface InventoryItem {
  id: string;
  barcode: string;
  deviceName: string;
  status: string;
  room: string;
  sku: string;
  lastUpdated: number;
}

const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const cacheItem = async (item: Omit<InventoryItem, 'lastUpdated'>) => {
  const db = await openDB();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').put({ ...item, lastUpdated: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const getCachedItem = async (barcode: string): Promise<InventoryItem | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readonly');
    const request = tx.objectStore('cache').get(barcode);
    
    request.onsuccess = () => {
      const item = request.result as InventoryItem;
      if (item) {
        // Check expiration
        if (Date.now() - item.lastUpdated > CACHE_EXPIRATION_MS) {
          resolve(null); // Expired
        } else {
          resolve(item);
        }
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
};
