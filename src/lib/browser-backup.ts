import { storeWeight } from "./store-weight";
import type { LifeStore } from "./types";

const DB_NAME = "mindos-backup";
const STORE = "snapshots";
const LATEST = "latest";
const MAX_HISTORY = 5;

export type BrowserSnapshot = {
  savedAt: string;
  weight: number;
  store: LifeStore;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveBrowserBackup(store: LifeStore): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const snapshot: BrowserSnapshot = {
    savedAt: new Date().toISOString(),
    weight: storeWeight(store),
    store,
  };
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const os = tx.objectStore(STORE);
  os.put(snapshot, LATEST);
  os.put(snapshot, snapshot.savedAt);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await prune(db);
  db.close();
}

async function prune(db: IDBDatabase) {
  const tx = db.transaction(STORE, "readwrite");
  const os = tx.objectStore(STORE);
  const keys = (await idbReq(os.getAllKeys())) as IDBValidKey[];
  const stamps = keys
    .map(String)
    .filter((k) => k !== LATEST)
    .sort()
    .reverse();
  for (const extra of stamps.slice(MAX_HISTORY)) {
    os.delete(extra);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadBrowserBackup(): Promise<BrowserSnapshot | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const row = (await idbReq(tx.objectStore(STORE).get(LATEST))) as BrowserSnapshot | undefined;
    db.close();
    return row?.store ? row : null;
  } catch {
    return null;
  }
}
