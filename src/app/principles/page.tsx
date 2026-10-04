"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EditableText } from "@/components/ui/EditableText";
import { EmptyState } from "@/components/ui/Progress";
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
  const [layer, setLayer] = useState<"inner" | "outer">("inner");
  const [lifeAreaId, setLifeAreaId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [filter, setFilter] = useState<"all" | "inner" | "outer">("all");
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
      layer,
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

  if (loading) return <p className="text-[var(--ink-faint)]">Загружаю…</p>;

  const shown = items.filter((p) => filter === "all" || p.layer === filter);

  return (
    <div className="space-y-8">
      <header>
        <p className="page-kicker">Принципы</p>
        <h1 className="page-title text-[2.2rem] md:text-[2.6rem]">Принципы</h1>
        <p className="page-lede">Правило → поведение → результат.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["all", "inner", "outer"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`btn ${filter === f ? "btn-primary" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Все" : f === "inner" ? "Внутреннее" : "Внешнее"}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title="Пока нет принципов"
          body="Напиши один стандарт, на котором строишь поведение."
        />
      ) : (
        <div className="space-y-2.5">
          {shown.map((p) => (
            <div key={p.id} className="surface space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[12px] font-bold text-[var(--accent)]">
                    {p.layer === "inner" ? "Внутреннее" : "Внешнее"}
                  </p>
                  <EditableText
                    value={p.title}
                    className="text-[16px] font-bold"
                    inputClassName="field text-[16px] font-bold"
                    onSave={(title) => savePrinciple(p.id, { title })}
                  />
                  <EditableText
                    value={p.body ?? ""}
                    className="mt-1 block text-[13px] text-[var(--ink-soft)]"
                    inputClassName="field text-[13px]"
                    multiline
                    placeholder="Добавить описание…"
                    onSave={(body) => savePrinciple(p.id, { body })}
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

      <form onSubmit={create} className="surface space-y-3 p-5">
        <p className="text-[13px] font-bold text-[var(--accent)]">Новый принцип</p>
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
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className="field"
            value={layer}
            onChange={(e) => setLayer(e.target.value as "inner" | "outer")}
          >
            <option value="inner">Внутреннее</option>
            <option value="outer">Внешнее</option>
          </select>
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

      <p className="text-[13px] font-semibold text-[var(--ink-faint)]">
        <Link href="/" className="font-bold text-[var(--accent)]">
          Жизнь
        </Link>
        {" · "}
        <Link href="/directions" className="font-bold text-[var(--accent)]">
          Направления
        </Link>
      </p>
    </div>
  );
}
