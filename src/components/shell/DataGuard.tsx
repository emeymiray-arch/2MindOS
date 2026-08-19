"use client";

import { useEffect } from "react";
import { loadBrowserBackup, saveBrowserBackup } from "@/lib/browser-backup";
import { storeWeight } from "@/lib/store-weight";
import type { LifeStore } from "@/lib/types";

async function exportStore(): Promise<LifeStore | null> {
  const res = await fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "export" }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.store as LifeStore) ?? null;
}

async function mirrorToBrowser() {
  const store = await exportStore();
  if (store && storeWeight(store) >= 1) {
    await saveBrowserBackup(store);
  }
}

async function recoverIfNeeded() {
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("mindos-autorestore")) {
    await mirrorToBrowser();
    return;
  }
  const [healthRes, browser] = await Promise.all([
    fetch("/api/health").then((r) => r.json()).catch(() => null),
    loadBrowserBackup(),
  ]);
  const serverWeight = Number(healthRes?.durability?.weight ?? 0);
  const browserWeight = browser?.weight ?? 0;
  if (browser && browserWeight > serverWeight && browserWeight >= 8) {
    const result = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restoreSafest", store: browser.store }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (result?.restored) {
      sessionStorage.setItem("mindos-autorestore", "1");
      window.location.reload();
    }
    return;
  }
  if (serverWeight >= 1) await mirrorToBrowser();
}

export function DataGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void recoverIfNeeded();

    const onSaved = () => {
      void mirrorToBrowser();
    };
    window.addEventListener("mindos:saved", onSaved);

    const tick = window.setInterval(() => {
      void mirrorToBrowser();
    }, 3 * 60 * 1000);

    const onVis = () => {
      if (document.visibilityState === "hidden") void mirrorToBrowser();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("mindos:saved", onSaved);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(tick);
    };
  }, []);

  return children;
}
