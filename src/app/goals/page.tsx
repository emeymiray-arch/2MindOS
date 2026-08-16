"use client";

import { Suspense } from "react";
import GoalsPage from "./GoalsClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="text-[var(--ink-faint)]">…</div>}>
      <GoalsPage />
    </Suspense>
  );
}
