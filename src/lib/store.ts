import { promises as fs } from "fs";
import path from "path";
import { pullCloudStore, pushCloudStore } from "./cloud-store";
import { migrateStore } from "./migrate";
import { createEmptyStore } from "./seed";
import { isSupabaseConfigured } from "./supabase";
import type { LifeStore } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "lifeos.json");

/** On Vercel the filesystem is ephemeral — Supabase snapshot is source of truth. */
function isServerless(): boolean {
  return process.env.VERCEL === "1" || process.env.MINDOS_CLOUD_PRIMARY === "1";
}

declare global {
  // eslint-disable-next-line no-var
  var __mindosStore: LifeStore | undefined;
  // eslint-disable-next-line no-var
  var __mindosWriteQueue: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __mindosCloudReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mindosWriteEpoch: number | undefined;
}

function epoch() {
  return global.__mindosWriteEpoch ?? 0;
}

function bumpEpoch() {
  global.__mindosWriteEpoch = epoch() + 1;
  return global.__mindosWriteEpoch;
}

async function persistLocal(store: LifeStore): Promise<boolean> {
  if (isServerless()) return false;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await fs.rename(tmp, STORE_PATH);
    return true;
  } catch (e) {
    console.error("[mindos] local persist failed:", e);
    return false;
  }
}

async function persist(store: LifeStore, syncCloud = false): Promise<void> {
  await persistLocal(store);

  if (!isSupabaseConfigured()) return;

  // On Vercel always await cloud write — otherwise data is lost between invocations.
  if (isServerless() || syncCloud) {
    try {
      const result = await pushCloudStore(store);
      global.__mindosCloudReady = result.ok;
      if (!result.ok) console.error("[mindos] cloud push:", result.error);
    } catch (e) {
      global.__mindosCloudReady = false;
      console.error("[mindos] cloud push failed:", e);
    }
    return;
  }

  void pushCloudStore(store)
    .then((result) => {
      global.__mindosCloudReady = result.ok;
    })
    .catch(() => {
      global.__mindosCloudReady = false;
    });
}

async function ensureLoaded(): Promise<LifeStore> {
  if (global.__mindosStore) return global.__mindosStore;

  // Production / Vercel: cloud is primary.
  if (isServerless() && isSupabaseConfigured()) {
    const cloud = await pullCloudStore();
    if (cloud) {
      global.__mindosStore = migrateStore(cloud);
      global.__mindosCloudReady = true;
      return global.__mindosStore;
    }
    global.__mindosStore = migrateStore(createEmptyStore());
    await persist(global.__mindosStore, true);
    return global.__mindosStore;
  }

  let local: LifeStore | null = null;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    local = migrateStore(JSON.parse(raw) as LifeStore);
  } catch {
    local = null;
  }

  // Local wins when a file already exists (dev machine).
  if (local) {
    global.__mindosStore = local;
    return global.__mindosStore;
  }

  // First local run: try cloud restore, else empty.
  if (isSupabaseConfigured()) {
    const cloud = await pullCloudStore();
    if (cloud) {
      global.__mindosStore = migrateStore(cloud);
      global.__mindosCloudReady = true;
      await persistLocal(global.__mindosStore);
      return global.__mindosStore;
    }
  }

  global.__mindosStore = migrateStore(createEmptyStore());
  await persist(global.__mindosStore);
  return global.__mindosStore;
}

export async function getStore(): Promise<LifeStore> {
  return ensureLoaded();
}

export async function updateStore(
  mutator: (store: LifeStore) => void | Promise<void>
): Promise<LifeStore> {
  const store = await ensureLoaded();
  const myEpoch = epoch();
  await mutator(store);
  const write = (global.__mindosWriteQueue ?? Promise.resolve()).then(async () => {
    if (myEpoch !== epoch()) return; // discarded after reset
    try {
      await persist(store);
    } catch (e) {
      console.error("[mindos] persist failed:", e);
    }
  });
  global.__mindosWriteQueue = write.then(
    () => undefined,
    () => undefined
  );
  await write;
  return global.__mindosStore ?? store;
}

export async function resetStore(): Promise<LifeStore> {
  await (global.__mindosWriteQueue ?? Promise.resolve()).catch(() => undefined);
  bumpEpoch();
  const next = migrateStore(createEmptyStore());
  global.__mindosStore = next;
  await persistLocal(next);
  if (isSupabaseConfigured()) {
    try {
      const result = await pushCloudStore(next);
      global.__mindosCloudReady = result.ok;
    } catch {
      global.__mindosCloudReady = false;
    }
  }
  return next;
}

export function lastCloudSyncOk(): boolean | undefined {
  return global.__mindosCloudReady;
}
