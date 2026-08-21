/** Shared client fetch — ignores abort noise, surfaces real errors. */
export async function apiPost(
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: Record<string, unknown>; error?: string }> {
  try {
    let res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    // One retry on transient cloud conflict / cold start.
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 400));
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    }
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }
    if (!res.ok || data.error) {
      return {
        ok: false,
        data,
        error: String(data.error ?? `HTTP ${res.status}`),
      };
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("mindos:saved"));
    }
    return { ok: true, data };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, data: {}, error: "Сохранение прервано" };
    }
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, data: {}, error: "Сохранение прервано" };
    }
    return { ok: false, data: {}, error: "Не удалось сохранить" };
  }
}
