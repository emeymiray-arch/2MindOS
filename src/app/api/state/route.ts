import { NextResponse } from "next/server";
import { pushCloudStore } from "@/lib/cloud-store";
import { defaultSettings, migrateStore } from "@/lib/migrate";
import { publicStore } from "@/lib/sanitize";
import {
  getStore,
  resetStore,
  restoreFromCloud,
  restoreSafest,
  storeWeight,
  updateStore,
} from "@/lib/store";
import type { LifeStore } from "@/lib/types";

export async function GET() {
  const store = await getStore();
  return NextResponse.json(publicStore(store));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.action === "reset") {
    if (body.confirm !== "RESET") {
      return NextResponse.json({ error: "confirm required" }, { status: 400 });
    }
    await resetStore();
    return NextResponse.json({ ok: true });
  }
  if (body.action === "theme") {
    const theme = body.theme === "dark" ? "dark" : "light";
    const store = await updateStore((s) => {
      s.settings.theme = theme;
    });
    return NextResponse.json({ ok: true, theme: store.settings.theme });
  }
  if (body.action === "settings") {
    const store = await updateStore((s) => {
      const patch = { ...(body.settings as object) } as Record<string, unknown>;
      if (patch.shortcutsToken === "") delete patch.shortcutsToken;
      s.settings = { ...defaultSettings(s.settings), ...patch };
    });
    return NextResponse.json({ ok: true, settings: store.settings });
  }
  if (body.action === "syncCloud") {
    const store = await getStore();
    const result = await pushCloudStore(store);
    return NextResponse.json({
      ...result,
      weight: storeWeight(store),
      goals: store.goals?.length ?? 0,
    });
  }
  if (body.action === "restoreCloud") {
    const result = await restoreFromCloud();
    return NextResponse.json(result);
  }
  if (body.action === "restoreSafest") {
    const incoming = body.store as LifeStore | undefined;
    const result = await restoreSafest(
      incoming && typeof incoming === "object" && Array.isArray(incoming.goals) ? incoming : undefined
    );
    return NextResponse.json(result);
  }
  if (body.action === "export") {
    const store = await getStore();
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      store,
    });
  }
  if (body.action === "import") {
    const incoming = body.store as LifeStore | undefined;
    if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.goals)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const store = await updateStore((s) => {
      const next = migrateStore(JSON.parse(JSON.stringify(incoming)) as LifeStore);
      Object.assign(s, next);
    });
    return NextResponse.json({ ok: true, store: publicStore(store) });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
