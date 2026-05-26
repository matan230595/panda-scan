import { openDB, DB_NAME, DB_VERSION } from './db';

export interface QueuedUpdate {
  id?: number;
  recordId: string;
  barcode: string;
  deviceName: string;
  newStatus: string;
  oldStatus: string;
  timestamp: number;
}

export const enqueueUpdate = async (update: Omit<QueuedUpdate, 'id'>) => {
  const db = await openDB();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').put(update);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const getQueue = async (): Promise<QueuedUpdate[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly');
    const request = tx.objectStore('queue').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const dequeueUpdate = async (id: number) => {
  const db = await openDB();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};
