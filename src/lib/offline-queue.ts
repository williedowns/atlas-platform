// Constants kept in sync with public/sw.js — that file is a classic service
// worker and can't import from src/, so changes here must be mirrored there.
import { openDB, type IDBPDatabase } from "idb";

export const OFFLINE_DB_NAME = "atlas-offline";
export const OFFLINE_STORE = "requests";
export const SW_MSG_QUEUED = "QUEUE_REQUEST_QUEUED";
export const SW_MSG_DRAINED = "QUEUE_REQUEST_DRAINED";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(OFFLINE_DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(OFFLINE_STORE)) {
          d.createObjectStore(OFFLINE_STORE, { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function getQueueCount(): Promise<number> {
  const p = db();
  if (!p) return 0;
  try {
    return await (await p).count(OFFLINE_STORE);
  } catch {
    return 0;
  }
}
