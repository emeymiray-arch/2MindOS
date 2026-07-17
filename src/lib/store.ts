import { promises as fs } from "fs";
import path from "path";
import { pullCloudStore, pushCloudStore } from "./cloud-store";
import { migrateStore } from "./migrate";
import { createSeedStore } from "./seed";
import { isSupabaseConfigured } from "./supabase";
import type { LifeStore } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "lifeos.json");

declare global {
  // eslint-disable-next-line no-var
  var __mindosStore: LifeStore | undefined;
  // eslint-disable-next-line no-var
  var __mindosWriteQueue: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __mindosCloudReady: boolean | undefined;
}

async function persistLocal(store: LifeStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, STORE_PATH);
}

async function persist(store: LifeStore): Promise<void> {
  await persistLocal(store);
  if (isSupabaseConfigured()) {
    const result = await pushCloudStore(store);
    global.__mindosCloudReady = result.ok;
  }
}

async function ensureLoaded(): Promise<LifeStore> {
  if (global.__mindosStore) return global.__mindosStore;

  let local: LifeStore | null = null;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    local = migrateStore(JSON.parse(raw) as LifeStore);
  } catch {
    local = null;
  }

  if (!local && isSupabaseConfigured()) {
    const cloud = await pullCloudStore();
    if (cloud) {
      global.__mindosStore = migrateStore(cloud);
      await persistLocal(global.__mindosStore);
      return global.__mindosStore;
    }
  }

  if (local) {
    global.__mindosStore = local;
  } else {
    global.__mindosStore = migrateStore(createSeedStore());
    await persist(global.__mindosStore);
  }

  return global.__mindosStore;
}

export async function getStore(): Promise<LifeStore> {
  return ensureLoaded();
}

export async function updateStore(
  mutator: (store: LifeStore) => void | Promise<void>
): Promise<LifeStore> {
  const store = await ensureLoaded();
  await mutator(store);
  const write = (global.__mindosWriteQueue ?? Promise.resolve()).then(() => persist(store));
  global.__mindosWriteQueue = write.then(
    () => undefined,
    () => undefined
  );
  await write;
  return store;
}

export async function resetStore(): Promise<LifeStore> {
  global.__mindosStore = migrateStore(createSeedStore());
  await persist(global.__mindosStore);
  return global.__mindosStore;
}

export function lastCloudSyncOk(): boolean | undefined {
  return global.__mindosCloudReady;
}
