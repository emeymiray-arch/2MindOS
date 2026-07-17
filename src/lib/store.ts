import { promises as fs } from "fs";
import path from "path";
import { migrateStore } from "./migrate";
import { createSeedStore } from "./seed";
import type { LifeStore } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "lifeos.json");

declare global {
  // eslint-disable-next-line no-var
  var __mindosStore: LifeStore | undefined;
  // eslint-disable-next-line no-var
  var __mindosWriteQueue: Promise<void> | undefined;
}

async function ensureLoaded(): Promise<LifeStore> {
  if (global.__mindosStore) return global.__mindosStore;

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    global.__mindosStore = migrateStore(JSON.parse(raw) as LifeStore);
  } catch {
    global.__mindosStore = createSeedStore();
    await persist(global.__mindosStore);
  }

  return global.__mindosStore;
}

async function persist(store: LifeStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, STORE_PATH);
}

export async function getStore(): Promise<LifeStore> {
  return ensureLoaded();
}

export async function updateStore(
  mutator: (store: LifeStore) => void | Promise<void>
): Promise<LifeStore> {
  const store = await ensureLoaded();
  await mutator(store);
  const write = (global.__mindosWriteQueue ?? Promise.resolve()).then(() =>
    persist(store)
  );
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
