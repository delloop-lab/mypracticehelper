/**
 * IndexedDB backup for voice recordings. Persists the recording blob + metadata
 * as soon as the user stops, so it can be recovered if the tab crashes before save.
 * Uses IndexedDB (not localStorage) because audio files exceed localStorage's ~5MB limit.
 */

const DB_NAME = "therapist-recording-backup";
const DB_VERSION = 1;
const STORE_NAME = "pending-recording";
const KEY = "latest";

export interface PendingRecordingBackup {
    blob: Blob;
    transcript: string;
    clientId?: string;
    clientName?: string;
    sessionId?: string;
    duration: number;
    savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !window.indexedDB) {
            reject(new Error("IndexedDB not available"));
            return;
        }
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

/** Save a recording to IndexedDB as soon as the user stops. Safe to call from main thread. */
export async function saveRecordingBackup(backup: Omit<PendingRecordingBackup, "savedAt">): Promise<void> {
    try {
        const db = await openDb();
        const payload: PendingRecordingBackup = {
            ...backup,
            savedAt: Date.now(),
        };
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(payload, KEY);
            req.onsuccess = () => {
                db.close();
                resolve();
            };
            req.onerror = () => {
                db.close();
                reject(req.error);
            };
        });
    } catch (e) {
        console.warn("[Recording Backup] Failed to save to IndexedDB:", e);
    }
}

/** Load a pending recording if one exists. Returns null if none or on error. */
export async function loadRecordingBackup(): Promise<PendingRecordingBackup | null> {
    try {
        const db = await openDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(KEY);
            req.onsuccess = () => {
                db.close();
                const data = req.result as PendingRecordingBackup | undefined;
                if (data && data.blob && data.savedAt) {
                    // Discard backups older than 24 hours
                    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
                        clearRecordingBackup();
                        resolve(null);
                    } else {
                        resolve(data);
                    }
                } else {
                    resolve(null);
                }
            };
            req.onerror = () => {
                db.close();
                resolve(null);
            };
        });
    } catch {
        return null;
    }
}

/** Remove the backup after save succeeds. */
export async function clearRecordingBackup(): Promise<void> {
    try {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(KEY);
            req.onsuccess = () => {
                db.close();
                resolve();
            };
            req.onerror = () => {
                db.close();
                reject(req.error);
            };
        });
    } catch {
        // Ignore
    }
}
