const DATABASE_NAME = 'plant-pending-assets';
const DATABASE_VERSION = 1;
const SCAN_STORE = 'lidar-scans';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SCAN_STORE)) database.createObjectStore(SCAN_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open scan storage.'));
  });
}

export async function saveScanBlob(assetId: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SCAN_STORE, 'readwrite');
    transaction.objectStore(SCAN_STORE).put(blob, assetId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not save scan.'));
  });
  database.close();
}

export async function loadScanBlob(assetId: string): Promise<Blob | null> {
  const database = await openDatabase();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction(SCAN_STORE, 'readonly');
    const request = transaction.objectStore(SCAN_STORE).get(assetId);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error || new Error('Could not load scan.'));
  });
  database.close();
  return result;
}

export async function deleteScanBlob(assetId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SCAN_STORE, 'readwrite');
    transaction.objectStore(SCAN_STORE).delete(assetId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not remove scan.'));
  });
  database.close();
}
