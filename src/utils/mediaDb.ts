/**
 * Zikro IndexedDB Media Persistence Engine
 * Enables zero-budget storage of full 1080p/4K client review videos
 * directly on the device with persistent playback across page reloads.
 */

const DB_NAME = 'editlock_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'video_blobs';

export interface StoredMediaRecord {
  projectId: string;
  blob: Blob;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storedAt: string;
}

// Memory cache of active ObjectURLs to avoid creating duplicates
const activeObjectUrls = new Map<string, string>();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a video or image file/blob persistently in IndexedDB
 */
export async function storeMediaBlob(
  projectId: string,
  fileOrBlob: Blob,
  fileName: string
): Promise<{ sizeBytes: number; objectUrl: string }> {
  try {
    const db = await openDatabase();
    const sizeBytes = fileOrBlob.size;
    const mimeType = fileOrBlob.type || 'video/mp4';

    const record: StoredMediaRecord = {
      projectId,
      blob: fileOrBlob,
      fileName,
      fileSizeBytes: sizeBytes,
      mimeType,
      storedAt: new Date().toISOString()
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Revoke old URL if any
    if (activeObjectUrls.has(projectId)) {
      URL.revokeObjectURL(activeObjectUrls.get(projectId)!);
    }

    const objectUrl = URL.createObjectURL(fileOrBlob);
    activeObjectUrls.set(projectId, objectUrl);

    return { sizeBytes, objectUrl };
  } catch (err) {
    console.error('Failed to store media in IndexedDB:', err);
    // Fallback: create temporary in-memory URL
    const fallbackUrl = URL.createObjectURL(fileOrBlob);
    return { sizeBytes: fileOrBlob.size, objectUrl: fallbackUrl };
  }
}

/**
 * Retrieves a persistent Object URL for the stored media blob
 */
export async function getMediaBlobUrl(projectId: string): Promise<string | null> {
  // Return cached ObjectURL if still valid in current session
  if (activeObjectUrls.has(projectId)) {
    return activeObjectUrls.get(projectId)!;
  }

  try {
    const db = await openDatabase();
    const record = await new Promise<StoredMediaRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(projectId);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (record && record.blob) {
      const url = URL.createObjectURL(record.blob);
      activeObjectUrls.set(projectId, url);
      return url;
    }
  } catch (err) {
    console.warn('Could not read from IndexedDB:', err);
  }

  return null;
}

/**
 * Deletes a stored media blob by projectId
 */
export async function deleteMediaBlob(projectId: string): Promise<void> {
  try {
    if (activeObjectUrls.has(projectId)) {
      URL.revokeObjectURL(activeObjectUrls.get(projectId)!);
      activeObjectUrls.delete(projectId);
    }

    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(projectId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete media blob:', err);
  }
}

/**
 * Returns total stored media size in bytes and count of cached projects
 */
export async function getMediaStorageStats(): Promise<{ totalProjects: number; totalSizeBytes: number }> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      let totalProjects = 0;
      let totalSizeBytes = 0;

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          totalProjects++;
          totalSizeBytes += cursor.value.fileSizeBytes || cursor.value.blob?.size || 0;
          cursor.continue();
        } else {
          resolve({ totalProjects, totalSizeBytes });
        }
      };

      req.onerror = () => resolve({ totalProjects: 0, totalSizeBytes: 0 });
    });
  } catch {
    return { totalProjects: 0, totalSizeBytes: 0 };
  }
}

/**
 * Clears all stored media blobs from device storage
 */
export async function clearAllMedia(): Promise<void> {
  try {
    for (const url of activeObjectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    activeObjectUrls.clear();

    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed clearing IndexedDB:', e);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
