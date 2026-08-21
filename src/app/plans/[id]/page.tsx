"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlanScheme } from "@/components/plan/PlanScheme";

export default function PlanDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const planId = String(params.id ?? "");
  const [backHref, setBackHref] = useState("/goals");
  const [ownerTitle, setOwnerTitle] = useState("Назад");

  useEffect(() => {
    fetch(`/api/work-plans?id=${encodeURIComponent(planId)}&lite=0`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const owner = json.owner as
          | { title?: string; goal?: { id: string }; project?: { id: string } }
          | undefined;
        const plan = json.plan as { ownerType?: string; ownerId?: string } | undefined;
        if (owner?.title) setOwnerTitle(owner.title);
        if (plan?.ownerType === "project" && plan.ownerId) {
          setBackHref(`/projects/${plan.ownerId}`);
        } else if (plan?.ownerId) {
          setBackHref(`/goals?id=${plan.ownerId}`);
        }
      })
      .catch(() => undefined);
  }, [planId]);

  if (!planId) {
    return (
      <div className="fade-in mx-auto max-w-2xl space-y-4">
        <p className="text-[var(--ink-soft)]">План не найден</p>
        <button type="button" className="btn btn-soft" onClick={() => router.back()}>
          ← Назад
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-6 pb-16">
      <Link href={backHref} className="text-[13px] font-medium text-[var(--ink-faint)]">
        ← {ownerTitle}
      </Link>
      <PlanScheme planId={planId} />
    </div>
  );
}
