import { promises as fs } from "fs";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { pullCloudBest, pullCloudResult, pushCloudCas, pushCloudStore } from "./cloud-store";
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
const SERVERLESS_WRITE_ATTEMPTS = 5;

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
  var __mindosRepoRoot: string | undefined;
}

export class StoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreUnavailableError";
  }
}

function cloneStore(store: LifeStore): LifeStore {
  return migrateStore(JSON.parse(JSON.stringify(store)) as LifeStore);
}

function emptyBrain(): LifeStore {
  const s = migrateStore(createEmptyStore());
  s.revision = 0;
  return s;
}

/** Always resolve the real 2MindOS package root — never trust a drifted process.cwd(). */
function findRepoRoot(): string {
  if (global.__mindosRepoRoot) return global.__mindosRepoRoot;

  const explicit = process.env.MINDOS_DATA_DIR?.trim();
  if (explicit) {
    // Allow pointing at the data folder or the repo root.
    const asDir = path.resolve(explicit);
    const root = path.basename(asDir) === "data" ? path.dirname(asDir) : asDir;
    global.__mindosRepoRoot = root;
    return root;
  }

  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
        if (pkg.name === "2mindos") {
          global.__mindosRepoRoot = dir;
          return dir;
        }
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Last resort: if cwd itself is named 2MindOS
  const cwd = process.cwd();
  if (path.basename(cwd) === "2MindOS" || path.basename(cwd) === "2mindos") {
    global.__mindosRepoRoot = cwd;
    return cwd;
  }

  global.__mindosRepoRoot = cwd;
  return cwd;
}

function dataDir(): string {
  return path.join(findRepoRoot(), "data");
}

function storePath(): string {
  return path.join(dataDir(), "lifeos.json");
}

function prevPath(): string {
  return path.join(dataDir(), "lifeos.prev.json");
}

function backupDir(): string {
  return path.join(dataDir(), "backups");
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

async function listBackupFiles(): Promise<string[]> {
  try {
    const names = await fs.readdir(backupDir());
    return names
      .filter((n) => n.startsWith("lifeos-") && n.endsWith(".json"))
      .sort()
      .reverse()
      .map((n) => path.join(backupDir(), n));
  } catch {
    return [];
  }
}

async function loadLocalCandidates(): Promise<LifeStore[]> {
  if (isServerless()) return [];
  await fs.mkdir(dataDir(), { recursive: true }).catch(() => undefined);
  const files = [storePath(), prevPath(), ...(await listBackupFiles())];
  const out: LifeStore[] = [];
  for (const file of files) {
    const store = await readStoreFile(file);
    if (store) out.push(store);
  }
  return out;
}

async function snapshotExistingLocal(): Promise<void> {
  if (isServerless()) return;
  const current = await readStoreFile(storePath());
  if (!current || isSparseStore(current)) return;

  try {
    await fs.copyFile(storePath(), prevPath());
  } catch {
    /* no previous file */
  }

  const now = Date.now();
  const last = global.__mindosLastFileBackupAt ?? 0;
  if (now - last < BACKUP_EVERY_MS) return;

  await fs.mkdir(backupDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(backupDir(), `lifeos-${stamp}.json`);
  await fs.copyFile(storePath(), dest);
  global.__mindosLastFileBackupAt = now;

  const extras = (await listBackupFiles()).slice(MAX_FILE_BACKUPS);
  await Promise.all(extras.map((f) => fs.unlink(f).catch(() => undefined)));
}

async function persistLocal(store: LifeStore): Promise<boolean> {
  if (isServerless()) return false;
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    await snapshotExistingLocal();
    const target = storePath();
    const tmp = `${target}.tmp`;
    const payload = JSON.stringify(store, null, 2);
    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, target);

    // Verify bytes landed — otherwise treat as failure.
    const verify = await fs.readFile(target, "utf8");
    if (verify.length < 20) {
      console.error("[mindos] local persist verify failed: tiny file");
      return false;
    }
    console.info("[mindos] local persist ok", {
      path: target,
      bytes: verify.length,
      goals: store.goals?.length ?? 0,
      weight: storeWeight(store),
    });
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

  // Local is source of truth on disk. Cloud is best-effort unless serverless.
  if (global.__mindosCloudReadable === false && !isServerless()) {
    console.error("[mindos] cloud unread — kept local only");
    return;
  }

  const run = async () => {
    const result = await pushCloudStore(store);
    global.__mindosCloudReady = result.ok;
    if (!result.ok) {
      console.error("[mindos] cloud push:", result.skipped ?? result.error);
    }
    return result;
  };

  // Await cloud only on Vercel (no durable disk) or when caller forces sync.
  if (isServerless() || syncCloud) {
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
  // Vercel: cloud is the only source of truth. Never invent an empty/demo brain
  // when the cloud blips — that caused data to vanish and reappear.
  if (isServerless()) {
    if (!isSupabaseConfigured()) {
      throw new StoreUnavailableError("cloud not configured");
    }
    const pulled = await pullCloudResult();
    global.__mindosCloudReadable = pulled.ok;
    if (!pulled.ok) {
      if (global.__mindosStore) return global.__mindosStore;
      throw new StoreUnavailableError(pulled.error || "cloud unavailable");
    }
    global.__mindosCloudReady = true;
    const store = pulled.store ? migrateStore(pulled.store) : emptyBrain();
    global.__mindosStore = store;
    return store;
  }

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

  const picked = richest([cloud, local]) ?? emptyBrain();
  global.__mindosStore = picked;

  if (cloud && local && !isDestructiveOverwrite(cloud, local) && storeWeight(cloud) > storeWeight(local)) {
    await persistLocal(picked);
  }

  if (!cloud && !local) {
    await persistLocal(picked);
  }

  return global.__mindosStore;
}

export async function getStore(): Promise<LifeStore> {
  return ensureLoaded();
}

async function updateStoreServerless(
  mutator: (store: LifeStore) => void | Promise<void>
): Promise<LifeStore> {
  if (!isSupabaseConfigured()) {
    throw new StoreUnavailableError("cloud not configured");
  }

  let lastError = "conflict";
  for (let attempt = 0; attempt < SERVERLESS_WRITE_ATTEMPTS; attempt++) {
    const pulled = await pullCloudResult();
    if (!pulled.ok) {
      throw new StoreUnavailableError(pulled.error || "cloud unavailable");
    }
    const expectedRev = Math.max(
      Number(pulled.store?.revision) || 0,
      Number(pulled.rowRevision) || 0
    );
    const draft = pulled.store ? cloneStore(pulled.store) : emptyBrain();
    draft.revision = expectedRev;
    await mutator(draft);
    draft.revision = expectedRev + 1;

    const pushed = await pushCloudCas(draft, expectedRev);
    if (pushed.ok) {
      global.__mindosStore = draft;
      global.__mindosCloudReady = true;
      global.__mindosCloudReadable = true;
      return draft;
    }
    if (pushed.conflict) {
      lastError = "conflict";
      continue;
    }
    if (pushed.skipped) {
      lastError = pushed.skipped;
      continue;
    }
    throw new StoreUnavailableError(pushed.error ?? "cloud persist failed");
  }
  throw new StoreUnavailableError(lastError);
}

export async function updateStore(
  mutator: (store: LifeStore) => void | Promise<void>
): Promise<LifeStore> {
  if (isServerless()) {
    return updateStoreServerless(mutator);
  }

  const store = await ensureLoaded();
  const myEpoch = epoch();
  await mutator(store);
  store.revision = (Number(store.revision) || 0) + 1;
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
  const pulled = await pullCloudBest();
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
    const pulled = await pullCloudBest();
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
  repoRoot: string;
  dataPath: string;
  goals: number;
  localBytes: number | null;
}> {
  const store = await ensureLoaded();
  const backups = isServerless() ? [] : await listBackupFiles();
  let localBytes: number | null = null;
  try {
    localBytes = (await fs.stat(storePath())).size;
  } catch {
    localBytes = null;
  }
  return {
    weight: storeWeight(store),
    sparse: isSparseStore(store),
    cloudOk: lastCloudSyncOk() ?? null,
    cloudReadable: global.__mindosCloudReadable ?? null,
    backupCount: backups.length,
    lastBackup: backups[0] ? path.basename(backups[0]) : null,
    repoRoot: findRepoRoot(),
    dataPath: storePath(),
    goals: store.goals?.length ?? 0,
    localBytes,
  };
}
