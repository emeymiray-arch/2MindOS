/** Shared client fetch — credentials included for session cookie. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export async function apiPost(
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: Record<string, unknown>; error?: string }> {
  try {
    let res = await apiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 400));
      res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

export async function apiGet(url: string): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await apiFetch(url);
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, data };
}
