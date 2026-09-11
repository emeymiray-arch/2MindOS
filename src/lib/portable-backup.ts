import { promises as fs } from "fs";
import path from "path";
import { migrateStore, CURRENT_VERSION } from "./migrate";
import { auditStore } from "./store-audit";
import { isDestructiveOverwrite, pickRicher, storeWeight } from "./store-weight";
import type { LifeStore } from "./types";

export const PORTABLE_FORMAT = "2mindos-portable";
export const PORTABLE_FORMAT_VERSION = 1;
const MAX_TIMESTAMPED_EXPORTS = 24;

export type PortableManifest = {
  format: typeof PORTABLE_FORMAT;
  formatVersion: number;
  exportedAt: string;
  exportKind: "manual" | "auto";
  appVersion: string;
  storeVersion: number;
  revision: number;
  weight: number;
  audit: ReturnType<typeof auditStore>;
  files: string[];
};

export type PortableExportInfo = {
  id: string;
  kind: "latest" | "timestamped";
  exportedAt: string;
  exportKind: "manual" | "auto";
  revision: number;
  weight: number;
  path: string;
};

function stampDir(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function parseStoreJson(raw: string): LifeStore | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const store =
      "store" in (parsed as object) && (parsed as { store?: LifeStore }).store
        ? (parsed as { store: LifeStore }).store
        : (parsed as LifeStore);
    if (!Array.isArray(store.goals)) return null;
    return migrateStore(JSON.parse(JSON.stringify(store)) as LifeStore);
  } catch {
    return null;
  }
}

async function readManifest(dir: string): Promise<PortableManifest | null> {
  try {
    const raw = await fs.readFile(path.join(dir, "manifest.json"), "utf8");
    return JSON.parse(raw) as PortableManifest;
  } catch {
    return null;
  }
}

async function pruneTimestampedExports(exportsDir: string) {
  let names: string[] = [];
  try {
    names = await fs.readdir(exportsDir);
  } catch {
    return;
  }
  const stamped = names
    .filter((n) => n !== "latest" && /^\d{4}-\d{2}-\d{2}T/.test(n))
    .sort()
    .reverse();
  for (const extra of stamped.slice(MAX_TIMESTAMPED_EXPORTS)) {
    await fs.rm(path.join(exportsDir, extra), { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function writePortableBundle(
  store: LifeStore,
  layout: {
    exportsDir: string;
    latestExportDir: string;
  },
  opts: { kind?: "manual" | "auto"; stamped?: boolean } = {}
): Promise<{ latestDir: string; stampedDir?: string; manifest: PortableManifest }> {
  const exportKind = opts.kind ?? "manual";
  const manifest = buildManifest(store, exportKind);
  const payload = JSON.stringify(store, null, 2);

  await fs.mkdir(layout.exportsDir, { recursive: true });
  await fs.mkdir(layout.latestExportDir, { recursive: true });
  await writeBundleFiles(layout.latestExportDir, payload, manifest);

  let stampedDir: string | undefined;
  if (opts.stamped !== false) {
    stampedDir = path.join(layout.exportsDir, stampDir());
    await fs.mkdir(stampedDir, { recursive: true });
    await writeBundleFiles(stampedDir, payload, manifest);
    await pruneTimestampedExports(layout.exportsDir);
  }

  return { latestDir: layout.latestExportDir, stampedDir, manifest };
}

function buildManifest(store: LifeStore, exportKind: "manual" | "auto"): PortableManifest {
  return {
    format: PORTABLE_FORMAT,
    formatVersion: PORTABLE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    exportKind,
    appVersion: process.env.npm_package_version ?? "0.1.2",
    storeVersion: CURRENT_VERSION,
    revision: Number(store.revision) || 0,
    weight: storeWeight(store),
    audit: auditStore(store),
    files: ["lifeos.json"],
  };
}

async function writeBundleFiles(dir: string, payload: string, manifest: PortableManifest) {
  const tmp = path.join(dir, "lifeos.json.tmp");
  const target = path.join(dir, "lifeos.json");
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, target);
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}

/** Update exports/latest only (lightweight auto-sync). */
export async function writeLatestPortableBundle(
  store: LifeStore,
  layout: { exportsDir: string; latestExportDir: string },
  kind: "manual" | "auto" = "auto"
): Promise<PortableManifest> {
  const manifest = buildManifest(store, kind);
  await fs.mkdir(layout.latestExportDir, { recursive: true });
  await writeBundleFiles(layout.latestExportDir, JSON.stringify(store, null, 2), manifest);
  return manifest;
}

/** Daily / periodic dated folder in exports/. */
export async function writeStampedPortableBundle(
  store: LifeStore,
  layout: { exportsDir: string; latestExportDir: string },
  kind: "manual" | "auto" = "auto"
): Promise<{ dir: string; manifest: PortableManifest }> {
  const manifest = buildManifest(store, kind);
  const payload = JSON.stringify(store, null, 2);
  const dir = path.join(layout.exportsDir, stampDir());
  await fs.mkdir(dir, { recursive: true });
  await writeBundleFiles(dir, payload, manifest);
  await pruneTimestampedExports(layout.exportsDir);
  return { dir, manifest };
}

export async function writeVaultReadme(vaultRoot: string, dataDir: string) {
  await fs.mkdir(vaultRoot, { recursive: true });
  const note = path.join(vaultRoot, "ПОДКЛЮЧИТЬ.txt");
  const text = [
    "2MindOS — твоя папка данных (Finder)",
    "",
    `Путь: ${vaultRoot}`,
    "",
    "Сохраняется автоматически при каждом изменении.",
    "Раз в сутки — новая копия в data/exports/.",
    "",
    "Если программа сломалась — новый проект:",
    "  1) Клонируй 2MindOS",
    "  2) В .env.local добавь:",
    `     MINDOS_DATA_DIR=${vaultRoot}`,
    "  3) npm run dev",
    "",
    "Или положи lifeos.json в data/import/ → Настройки → Подтянуть.",
    "",
    `Активный файл: ${path.join(dataDir, "lifeos.json")}`,
  ].join("\n");
  try {
    const prev = await fs.readFile(note, "utf8");
    if (prev === text) return;
  } catch {
    /* write */
  }
  await fs.writeFile(note, text, "utf8");
}

async function loadStoreFromDir(dir: string): Promise<LifeStore | null> {
  const manifest = await readManifest(dir);
  const storeFile = path.join(dir, manifest?.files?.[0] ?? "lifeos.json");
  try {
    const raw = await fs.readFile(storeFile, "utf8");
    return parseStoreJson(raw);
  } catch {
    return null;
  }
}

/** Read portable bundle from data/import — flat file or subfolder with manifest. */
export async function loadImportCandidate(importDir: string): Promise<{
  store: LifeStore | null;
  source: string;
  manifest: PortableManifest | null;
}> {
  await fs.mkdir(importDir, { recursive: true });

  const candidates: { dir: string; label: string }[] = [
    { dir: importDir, label: "import/" },
    { dir: path.join(importDir, "latest"), label: "import/latest/" },
  ];

  try {
    const entries = await fs.readdir(importDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name !== "latest") {
        candidates.push({ dir: path.join(importDir, e.name), label: `import/${e.name}/` });
      }
    }
  } catch {
    /* empty */
  }

  for (const c of candidates) {
    const store = await loadStoreFromDir(c.dir);
    if (store) {
      return { store, source: c.label, manifest: await readManifest(c.dir) };
    }
    try {
      const files = await fs.readdir(c.dir);
      const json = files.find((f) => f.endsWith(".json") && f !== "manifest.json");
      if (json) {
        const raw = await fs.readFile(path.join(c.dir, json), "utf8");
        const parsed = parseStoreJson(raw);
        if (parsed) return { store: parsed, source: `${c.label}${json}`, manifest: null };
      }
    } catch {
      /* next */
    }
  }

  return { store: null, source: "", manifest: null };
}

export async function listPortableExports(exportsDir: string): Promise<PortableExportInfo[]> {
  const out: PortableExportInfo[] = [];
  try {
    await fs.mkdir(exportsDir, { recursive: true });
    const latest = path.join(exportsDir, "latest");
    const manifest = await readManifest(latest);
    if (manifest) {
      out.push({
        id: "latest",
        kind: "latest",
        exportedAt: manifest.exportedAt,
        exportKind: manifest.exportKind,
        revision: manifest.revision,
        weight: manifest.weight,
        path: latest,
      });
    }
    const names = (await fs.readdir(exportsDir)).filter(
      (n) => n !== "latest" && /^\d{4}-\d{2}-\d{2}T/.test(n)
    );
    for (const name of names.sort().reverse()) {
      const dir = path.join(exportsDir, name);
      const m = await readManifest(dir);
      if (!m) continue;
      out.push({
        id: name,
        kind: "timestamped",
        exportedAt: m.exportedAt,
        exportKind: m.exportKind,
        revision: m.revision,
        weight: m.weight,
        path: dir,
      });
    }
  } catch {
    /* no exports yet */
  }
  return out;
}

export async function loadExportById(
  exportsDir: string,
  id: string
): Promise<{ store: LifeStore | null; manifest: PortableManifest | null }> {
  const dir = id === "latest" ? path.join(exportsDir, "latest") : path.join(exportsDir, id);
  const store = await loadStoreFromDir(dir);
  return { store, manifest: await readManifest(dir) };
}

export function mergeImportDecision(
  current: LifeStore,
  incoming: LifeStore,
  mode: "replace" | "merge"
): { store: LifeStore; strategy: "replace" | "merge-richer" | "kept-current" } {
  if (mode === "replace") {
    return { store: incoming, strategy: "replace" };
  }
  const richer = pickRicher(current, incoming);
  if (!richer) return { store: incoming, strategy: "replace" };
  if (richer === current) {
    return { store: current, strategy: "kept-current" };
  }
  if (isDestructiveOverwrite(incoming, current)) {
    return { store: current, strategy: "kept-current" };
  }
  return { store: richer, strategy: "merge-richer" };
}

export async function writeImportInstructions(importDir: string, dataDir: string) {
  await fs.mkdir(importDir, { recursive: true });
  const note = path.join(importDir, "HOWTO.txt");
  try {
    await fs.access(note);
  } catch {
    await fs.writeFile(
      note,
      [
        "2MindOS — папка импорта",
        "",
        "Положи сюда один из вариантов:",
        "  1) lifeos.json",
        "  2) папку latest/ из exports (manifest.json + lifeos.json)",
        "  3) файл 2mindos-backup-YYYY-MM-DD.json из браузера",
        "",
        `Затем в Настройках нажми «Подтянуть из import/».`,
        "",
        `Активные данные: ${dataDir}/lifeos.json`,
        `Выгрузки: ${path.join(dataDir, "exports")}/latest/`,
        "",
        "Новый проект: задай MINDOS_DATA_DIR в .env.local на путь к этой папке data/",
      ].join("\n"),
      "utf8"
    );
  }
}
