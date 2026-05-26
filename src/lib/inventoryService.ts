import { db, auth } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type FirebaseInventoryItem = {
  barcode: string;
  deviceName: string;
  status: string;
  room: string;
  sku: string;
  deviceType?: string;
  appLogoUrl?: string;
  linkedApp?: string;
  deviceNetwork?: string;
  lastUpdated: number;
};

export async function fetchInventoryItemByBarcode(barcode: string) {
  const q = query(collection(db, 'inventory'), where('barcode', '==', barcode));
  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as FirebaseInventoryItem & { id: string };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'inventory');
    return null;
  }
}

export async function updateInventoryItemStatus(id: string, newStatus: string) {
  const docRef = doc(db, 'inventory', id);
  try {
    await updateDoc(docRef, {
      status: newStatus,
      lastUpdated: Date.now()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `inventory/${id}`);
  }
}

export async function getAllInventoryItems() {
  const q = query(collection(db, 'inventory'));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseInventoryItem & { id: string }))
      .sort((a, b) => b.lastUpdated - a.lastUpdated); // simple client sort
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'inventory');
    return [];
  }
}

export async function saveInventoryItem(item: FirebaseInventoryItem & { id?: string }) {
  const docId = item.id || item.barcode;
  const docRef = doc(db, 'inventory', docId);
  try {
    // Remove safe-guard against undefined properties which Firestore of enterprise edition doesn't like
    const cleanItem = Object.fromEntries(
      Object.entries({ ...item, lastUpdated: Date.now() })
        .filter(([_, value]) => value !== undefined)
    );
    await setDoc(docRef, cleanItem);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `inventory/${docId}`);
  }
}

export async function deleteInventoryItem(id: string) {
  const docRef = doc(db, 'inventory', id);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `inventory/${id}`);
  }
}

export async function clearAllInventory() {
  const q = query(collection(db, 'inventory'));
  try {
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, 'inventory', docSnap.id)));
    await Promise.all(deletePromises);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'inventory');
  }
}

export async function saveInventoryItemsBatch(
  items: (FirebaseInventoryItem & { id?: string })[],
  onProgress?: (count: number) => void
) {
  const limit = 400; // conservative batch limit (Firestore MAX is 500)
  let committed = 0;
  
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const batch = writeBatch(db);
    
    for (const item of chunk) {
      const docId = item.id || item.barcode;
      const docRef = doc(db, 'inventory', docId);
      const cleanItem = Object.fromEntries(
        Object.entries({ ...item, lastUpdated: Date.now() })
          .filter(([_, value]) => value !== undefined)
      );
      batch.set(docRef, cleanItem);
    }
    
    try {
      await batch.commit();
      committed += chunk.length;
      if (onProgress) {
        onProgress(committed);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory/batch');
    }
  }
}

