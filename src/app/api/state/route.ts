import { NextResponse } from "next/server";
import { defaultSettings, migrateStore } from "@/lib/migrate";
import { publicStore } from "@/lib/sanitize";
import { getStore, resetStore, updateStore } from "@/lib/store";
import type { LifeStore } from "@/lib/types";

export async function GET() {
  const store = await getStore();
  return NextResponse.json(publicStore(store));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.action === "reset") {
    await resetStore();
    // Keep response tiny so the browser never aborts on a huge dump.
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
      // never wipe token to empty accidentally
      if (patch.shortcutsToken === "") delete patch.shortcutsToken;
      s.settings = { ...defaultSettings(s.settings), ...patch };
    });
    return NextResponse.json({ ok: true, settings: store.settings });
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
