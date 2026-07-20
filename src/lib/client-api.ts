/** Shared client fetch — ignores abort noise, surfaces real errors. */
export async function apiPost(
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
    return { ok: true, data };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: true, data: {} };
    }
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: true, data: {} };
    }
    return { ok: false, data: {}, error: "Не удалось сохранить" };
  }
}
