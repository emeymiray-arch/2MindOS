"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastKind = "ok" | "info" | "warn";

type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
};

const ToastCtx = createContext<(message: string, kind?: ToastKind) => void>(() => undefined);

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; kind?: ToastKind }>).detail;
      if (detail?.message) push(detail.message, detail.kind ?? "info");
    };
    window.addEventListener("mindos-toast", onToast);
    return () => window.removeEventListener("mindos-toast", onToast);
  }, [push]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast-item">
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function toast(message: string, kind: ToastKind = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mindos-toast", { detail: { message, kind } }));
}
