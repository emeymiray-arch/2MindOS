import { promises as fs } from "fs";
import path from "path";
import { pullCloudResult, pushCloudStore } from "./cloud-store";
import { migrateStore } from "./migrate";
import { createEmptyStore } from "./seed";
import { isSupabaseConfigured } from "./supabase";
import {
  isDestructiveOverwrite,
  isSparseStore,
  pickRicher,
  storeWeight,
} from "./store-weight";
import type { LifeStore } from "./types";

export { storeWeight, isSparseStore } from "./store-weight";

const MAX_FILE_BACKUPS = 30;
const BACKUP_EVERY_MS = 15 * 60 * 1000;
const APP_DIR_NAME = "2MindOS";

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
  // eslint-disable-next-line no-var
  var __mindosLastFileBackupAt: number | undefined;
  // eslint-disable-next-line no-var
  var __mindosCloudReadable: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mindosPrimaryDataDir: string | undefined;
}

function dataDirCandidates(): string[] {
  const set = new Set<string>();
  const explicit = process.env.MINDOS_DATA_DIR?.trim();
  if (explicit) set.add(path.resolve(explicit));
  const cwd = process.cwd();
  set.add(path.join(cwd, "data"));
  set.add(path.join(cwd, APP_DIR_NAME, "data"));
  const parent = path.dirname(cwd);
  set.add(path.join(parent, APP_DIR_NAME, "data"));
  return [...set];
}

function pathsForDir(dataDir: string) {
  return {
    dataDir,
    storePath: path.join(dataDir, "lifeos.json"),
    prevPath: path.join(dataDir, "lifeos.prev.json"),
    backupDir: path.join(dataDir, "backups"),
  };
}

function epoch() {
  return global.__mindosWriteEpoch ?? 0;
}

function bumpEpoch() {
  global.__mindosWriteEpoch = epoch() + 1;
  return global.__mindosWriteEpoch;
}

function parseStore(raw: string): LifeStore | null {
  try {
    const parsed = JSON.parse(raw) as LifeStore;
    if (!parsed || typeof parsed !== "object") return null;
    return migrateStore(parsed);
  } catch {
    return null;
  }
}

async function readStoreFile(file: string): Promise<LifeStore | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return parseStore(raw);
  } catch {
    return null;
  }
}

async function listBackupFiles(backupDir: string): Promise<string[]> {
  try {
    const names = await fs.readdir(backupDir);
    return names
      .filter((n) => n.startsWith("lifeos-") && n.endsWith(".json"))
      .sort()
      .reverse()
      .map((n) => path.join(backupDir, n));
  } catch {
    return [];
  }
}

async function resolvePrimaryDataDir(): Promise<string> {
  if (global.__mindosPrimaryDataDir) return global.__mindosPrimaryDataDir;
  const dirs = dataDirCandidates();
  let bestDir = dirs[0];
  let bestWeight = -1;
  for (const dir of dirs) {
    const { storePath } = pathsForDir(dir);
    const store = await readStoreFile(storePath);
    const weight = storeWeight(store);
    if (weight > bestWeight) {
      bestWeight = weight;
      bestDir = dir;
    }
  }
  global.__mindosPrimaryDataDir = bestDir;
  return bestDir;
}

async function loadLocalCandidates(): Promise<LifeStore[]> {
  if (isServerless()) return [];
  const dirs = dataDirCandidates();
  const out: LifeStore[] = [];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true }).catch(() => undefined);
    const p = pathsForDir(dir);
    const files = [p.storePath, p.prevPath, ...(await listBackupFiles(p.backupDir))];
    for (const file of files) {
      const store = await readStoreFile(file);
      if (store) out.push(store);
    }
  }
  return out;
}

async function snapshotExistingLocal(): Promise<void> {
  if (isServerless()) return;
  const dir = await resolvePrimaryDataDir();
  const p = pathsForDir(dir);
  const current = await readStoreFile(p.storePath);
  if (!current || isSparseStore(current)) return;

  try {
    await fs.copyFile(p.storePath, p.prevPath);
  } catch {
    /* no previous file */
  }

  const now = Date.now();
  const last = global.__mindosLastFileBackupAt ?? 0;
  if (now - last < BACKUP_EVERY_MS) return;

  await fs.mkdir(p.backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(p.backupDir, `lifeos-${stamp}.json`);
  await fs.copyFile(p.storePath, dest);
  global.__mindosLastFileBackupAt = now;

  const extras = (await listBackupFiles(p.backupDir)).slice(MAX_FILE_BACKUPS);
  await Promise.all(extras.map((f) => fs.unlink(f).catch(() => undefined)));
}

async function persistLocal(store: LifeStore): Promise<boolean> {
  if (isServerless()) return false;
  try {
    const primary = await resolvePrimaryDataDir();
    const p = pathsForDir(primary);
    await fs.mkdir(p.dataDir, { recursive: true });
    await snapshotExistingLocal();
    const tmp = `${p.storePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await fs.rename(tmp, p.storePath);

    // Mirror into other candidate roots so data survives root-directory drift.
    for (const dir of dataDirCandidates()) {
      if (dir === primary) continue;
      const alt = pathsForDir(dir);
      await fs.mkdir(alt.dataDir, { recursive: true }).catch(() => undefined);
      await fs.writeFile(alt.storePath, JSON.stringify(store, null, 2), "utf8").catch(() => undefined);
    }
    return true;
  } catch (e) {
    console.error("[mindos] local persist failed:", e);
    return false;
  }
}

async function persist(store: LifeStore, syncCloud = false): Promise<void> {
  const localOk = await persistLocal(store);
  if (!isServerless() && !localOk) {
    throw new Error("local persist failed");
  }

  if (!isSupabaseConfigured()) {
    if (isServerless()) throw new Error("cloud not configured");
    return;
  }
  if (global.__mindosCloudReadable === false) {
    // Cloud is configured but unread — never guess by pushing.
    if (isServerless()) throw new Error("cloud unread, refuse persist");
    return;
  }

  const shouldWait = isServerless() || syncCloud;
  const run = async () => {
    const result = await pushCloudStore(store);
    global.__mindosCloudReady = result.ok;
    if (!result.ok) {
      console.error("[mindos] cloud push:", result.skipped ?? result.error);
    }
    return result;
  };

  if (shouldWait) {
    const result = await run();
    if (isServerless() && !result.ok && !result.skipped) {
      throw new Error(result.error ?? "cloud persist failed");
    }
    return;
  }

  void run().catch(() => {
    global.__mindosCloudReady = false;
  });
}

function richest(stores: Array<LifeStore | null | undefined>): LifeStore | null {
  return stores.reduce<LifeStore | null>((best, cur) => pickRicher(best, cur ?? null), null);
}

async function ensureLoaded(): Promise<LifeStore> {
  if (global.__mindosStore) return global.__mindosStore;

  const locals = await loadLocalCandidates();
  const local = richest(locals);

  let cloud: LifeStore | null = null;
  if (isSupabaseConfigured()) {
    const pulled = await pullCloudResult();
    global.__mindosCloudReadable = pulled.ok;
    if (pulled.ok) {
      cloud = pulled.store ? migrateStore(pulled.store) : null;
      global.__mindosCloudReady = true;
    } else {
      global.__mindosCloudReady = false;
      console.error("[mindos] cloud pull failed:", pulled.error);
    }
  }

  const picked =
    richest([cloud, local]) ?? migrateStore(createEmptyStore());

  global.__mindosStore = picked;

  if (cloud && local && !isDestructiveOverwrite(cloud, local) && storeWeight(cloud) > storeWeight(local)) {
    await persistLocal(picked);
  }

  // First run: write local file only. Never push an empty/demo brain to the cloud.
  if (!cloud && !local && !isServerless()) {
    await persistLocal(picked);
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
  const myEpoch = epoch();
  await mutator(store);
  const write = (global.__mindosWriteQueue ?? Promise.resolve()).then(async () => {
    if (myEpoch !== epoch()) return;
    await persist(store);
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
  const current = global.__mindosStore;
  if (current && !isSparseStore(current)) {
    await persistLocal(current);
  }
  bumpEpoch();
  const next = migrateStore(createEmptyStore());
  global.__mindosStore = next;
  await persistLocal(next);
  return next;
}

export function lastCloudSyncOk(): boolean | undefined {
  return global.__mindosCloudReady;
}

export async function restoreFromCloud(): Promise<{
  ok: boolean;
  restored: boolean;
  localWeight: number;
  cloudWeight: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, restored: false, localWeight: 0, cloudWeight: 0, error: "cloud not configured" };
  }
  const current = await ensureLoaded();
  const pulled = await pullCloudResult();
  if (!pulled.ok) {
    return {
      ok: false,
      restored: false,
      localWeight: storeWeight(current),
      cloudWeight: 0,
      error: pulled.error,
    };
  }
  if (!pulled.store) {
    return {
      ok: false,
      restored: false,
      localWeight: storeWeight(current),
      cloudWeight: 0,
      error: "no snapshot",
    };
  }
  const cloud = migrateStore(pulled.store);
  const lw = storeWeight(current);
  const cw = storeWeight(cloud);
  if (cw <= lw) {
    return { ok: true, restored: false, localWeight: lw, cloudWeight: cw };
  }
  bumpEpoch();
  global.__mindosStore = cloud;
  await persistLocal(cloud);
  global.__mindosCloudReady = true;
  return { ok: true, restored: true, localWeight: lw, cloudWeight: cw };
}

export async function restoreSafest(candidate?: LifeStore): Promise<{
  restored: boolean;
  weight: number;
  source: "current" | "cloud" | "local" | "browser";
}> {
  const current = await ensureLoaded();
  const locals = await loadLocalCandidates();
  let cloud: LifeStore | null = null;
  if (isSupabaseConfigured()) {
    const pulled = await pullCloudResult();
    if (pulled.ok && pulled.store) cloud = migrateStore(pulled.store);
  }
  const incoming = candidate ? migrateStore(JSON.parse(JSON.stringify(candidate)) as LifeStore) : null;

  const options: { store: LifeStore; source: "current" | "cloud" | "local" | "browser"; weight: number }[] = [
    { store: current, source: "current", weight: storeWeight(current) },
  ];
  if (cloud) options.push({ store: cloud, source: "cloud", weight: storeWeight(cloud) });
  const localBest = richest(locals);
  if (localBest) options.push({ store: localBest, source: "local", weight: storeWeight(localBest) });
  if (incoming) options.push({ store: incoming, source: "browser", weight: storeWeight(incoming) });

  options.sort((a, b) => b.weight - a.weight);
  const best = options[0];
  const currentW = storeWeight(current);
  if (!best || best.weight <= currentW) {
    return { restored: false, weight: currentW, source: "current" };
  }

  bumpEpoch();
  global.__mindosStore = best.store;
  await persistLocal(best.store);
  if (!isSparseStore(best.store) && global.__mindosCloudReadable !== false) {
    try {
      await persist(best.store, true);
    } catch (e) {
      console.error("[mindos] restore cloud sync:", e);
    }
  }
  return { restored: true, weight: best.weight, source: best.source };
}

export async function durabilityStatus(): Promise<{
  weight: number;
  sparse: boolean;
  cloudOk: boolean | null;
  cloudReadable: boolean | null;
  backupCount: number;
  lastBackup: string | null;
}> {
  const store = await ensureLoaded();
  const primary = await resolvePrimaryDataDir();
  const backups = isServerless() ? [] : await listBackupFiles(pathsForDir(primary).backupDir);
  return {
    weight: storeWeight(store),
    sparse: isSparseStore(store),
    cloudOk: lastCloudSyncOk() ?? null,
    cloudReadable: global.__mindosCloudReadable ?? null,
    backupCount: backups.length,
    lastBackup: backups[0] ? path.basename(backups[0]) : null,
  };
}
