"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EditableText } from "@/components/ui/EditableText";
import { EmptyState } from "@/components/ui/Progress";
import { PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type Principle = {
  id: string;
  title: string;
  body?: string;
  layer: "outer" | "inner";
  lifeAreaId?: string;
  supportsGoalIds: string[];
  supportsHabitIds: string[];
};

export default function PrinciplesPage() {
  const [items, setItems] = useState<Principle[]>([]);
  const [dirs, setDirs] = useState<{ id: string; name: string }[]>([]);
  const [goals, setGoals] = useState<{ id: string; name?: string; title?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lifeAreaId, setLifeAreaId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiGet("/api/life?kind=principles");
    if (res.ok) {
      setItems((res.data.principles as Principle[]) ?? []);
      setDirs((res.data.directions as { id: string; name: string }[]) ?? []);
      setGoals((res.data.goals as { id: string; title: string }[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const res = await apiPost("/api/life", {
      action: "createPrinciple",
      title: title.trim(),
      body: body.trim() || undefined,
      layer: "inner",
      lifeAreaId: lifeAreaId || undefined,
      supportsGoalIds: goalId ? [goalId] : [],
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не создалось", "warn");
      return;
    }
    setTitle("");
    setBody("");
    setGoalId("");
    toast("Принцип сохранён", "ok");
    await load();
  }

  async function archive(id: string) {
    setBusy(true);
    const res = await apiPost("/api/life", { action: "updatePrinciple", id, archived: true });
    setBusy(false);
    if (!res.ok) toast(res.error ?? "Не удалось", "warn");
    else await load();
  }

  async function savePrinciple(id: string, patch: { title?: string; body?: string }) {
    const res = await apiPost("/api/life", { action: "updatePrinciple", id, ...patch });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
  }

  if (loading) {
    return (
      <div className="page-stack">
        <PageHero title="Принципы" />
        <section className="panel">
          <p className="text-[var(--ink-faint)]">Загружаю…</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHero title="Принципы" />

      <form onSubmit={create} className="panel space-y-3">
        <WidgetHead title="Новый принцип" tone="violet" />
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: говорю спокойно, даже когда спорю"
        />
        <textarea
          className="field resize-none"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Как это проявляется в поведении"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="field"
            value={lifeAreaId}
            onChange={(e) => setLifeAreaId(e.target.value)}
          >
            <option value="">Направление…</option>
            {dirs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className="field" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">Связать с целью…</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Сохранить
        </button>
      </form>

      <section className="panel space-y-3">
        <WidgetHead title="Список" tone="green" action={<span className="text-[12px] text-[var(--ink-faint)]">{items.length}</span>} />
        {items.length === 0 ? (
          <EmptyState
            title="Пока нет принципов"
            body="Напиши один стандарт, на котором строишь поведение."
          />
        ) : (
          <div className="stack-tight">
            {items.map((p) => (
              <div key={p.id} className="surface space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <EditableText
                      value={p.title}
                      className="text-[16px] font-bold"
                      inputClassName="field text-[16px] font-bold"
                      onSave={(next) => savePrinciple(p.id, { title: next })}
                    />
                    <EditableText
                      value={p.body ?? ""}
                      className="mt-1 block text-[13px] text-[var(--ink-soft)]"
                      inputClassName="field text-[13px]"
                      multiline
                      placeholder="Добавить описание…"
                      onSave={(next) => savePrinciple(p.id, { body: next })}
                    />
                    {p.supportsGoalIds?.length ? (
                      <p className="mt-2 text-[12px] font-semibold text-[var(--ink-faint)]">
                        Связано с{" "}
                        {p.supportsGoalIds
                          .map((gid) => goals.find((g) => g.id === gid)?.title)
                          .filter(Boolean)
                          .join(", ") || "целями"}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void archive(p.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <Link href="/inbox" className="font-semibold text-[var(--accent)]">
          ← Inbox
        </Link>
      </section>
    </div>
  );
}
