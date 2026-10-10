"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import {
  IconBook,
  IconSettings,
  IconShield,
  IconTarget,
} from "@/components/ui/Icons";
import { EmptyState } from "@/components/ui/Progress";
import { PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type Capture = {
  id: string;
  raw: string;
  status: string;
  directionId?: string;
  goalId?: string;
  principleId?: string;
  note?: string;
  createdAt: string;
};

const HUB = [
  { href: "/principles", label: "Принципы", hint: "Правила жизни", Icon: IconBook },
  { href: "/settings", label: "Настройки", hint: "Акцент, тема, профиль", Icon: IconSettings },
  { href: "/privacy", label: "Данные", hint: "Хранение и экспорт", Icon: IconShield },
] as const;

export default function InboxPage() {
  const [items, setItems] = useState<Capture[]>([]);
  const [dirs, setDirs] = useState<{ id: string; name: string }[]>([]);
  const [goals, setGoals] = useState<{ id: string; title: string }[]>([]);
  const [principles, setPrinciples] = useState<{ id: string; title: string }[]>([]);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const load = useCallback(async () => {
    const [inboxRes, authRes] = await Promise.all([
      apiGet("/api/life?kind=inbox"),
      apiGet("/api/auth"),
    ]);
    if (inboxRes.ok) {
      setItems((inboxRes.data.captures as Capture[]) ?? []);
      setDirs((inboxRes.data.directions as { id: string; name: string }[]) ?? []);
      setGoals((inboxRes.data.goals as { id: string; title: string }[]) ?? []);
      setPrinciples((inboxRes.data.principles as { id: string; title: string }[]) ?? []);
    }
    if (authRes.ok) {
      const d = authRes.data as { isAdmin?: boolean; login?: string };
      setShowAdmin(Boolean(d.isAdmin));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function capture(e: React.FormEvent) {
    e.preventDefault();
    if (!raw.trim() || busy) return;
    setBusy(true);
    const res = await apiPost("/api/life", { action: "capture", raw: raw.trim() });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не сохранилось", "warn");
      return;
    }
    setRaw("");
    toast("В inbox", "ok");
    await load();
  }

  async function link(
    id: string,
    patch: { directionId?: string; goalId?: string; principleId?: string }
  ) {
    setBusy(true);
    const res = await apiPost("/api/life", { action: "linkCapture", id, ...patch });
    setBusy(false);
    if (!res.ok) toast(res.error ?? "Не связалось", "warn");
    else await load();
  }

  if (loading) {
    return (
      <div className="page-stack">
        <PageHero title="Inbox" />
        <section className="panel">
          <p className="text-[var(--ink-faint)]">Открываю…</p>
        </section>
      </div>
    );
  }

  const pending = items.filter((c) => c.status === "pending");
  const done = items.filter((c) => c.status !== "pending");

  return (
    <div className="page-stack">
      <PageHero title="Inbox" />

      <section className="panel space-y-3">
        <WidgetHead title="Разделы" tone="green" />
        <div className="bento">
          {HUB.map((l) => (
            <Link key={l.href} href={l.href} className="span-6 next-card life-tile">
              <span className="next-ico" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>
                <l.Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold tracking-tight">{l.label}</span>
                <span className="mt-0.5 block text-[12px] text-[var(--ink-faint)]">{l.hint}</span>
              </span>
            </Link>
          ))}
          {showAdmin ? (
            <Link href="/admin" className="span-6 next-card life-tile">
              <span className="next-ico" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>
                <IconTarget size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold tracking-tight">Админ</span>
                <span className="mt-0.5 block text-[12px] text-[var(--ink-faint)]">Клиенты</span>
              </span>
            </Link>
          ) : null}
        </div>
      </section>

      <form onSubmit={capture} className="panel space-y-3">
        <WidgetHead title="Новая заметка" tone="blue" />
        <textarea
          className="field resize-none"
          rows={3}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Мысль, книга, инсайт, человек, план…"
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Сохранить
        </button>
      </form>

      <section className="panel space-y-3">
        <WidgetHead
          title="Ждут связи"
          tone="orange"
          action={
            <span className="text-[12px] text-[var(--ink-faint)]">{pending.length}</span>
          }
        />
        {pending.length === 0 ? (
          <EmptyState title="Пусто" body="Пиши сюда всё, что не должно потеряться." />
        ) : (
          <div className="stack-tight">
            {pending.map((c) => (
              <div key={c.id} className="surface space-y-3 p-4">
                <p className="text-[15px] font-semibold">{c.raw}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    className="field"
                    defaultValue=""
                    disabled={busy}
                    onChange={(e) => {
                      if (e.target.value) void link(c.id, { directionId: e.target.value });
                    }}
                  >
                    <option value="">Направление…</option>
                    {dirs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field"
                    defaultValue=""
                    disabled={busy}
                    onChange={(e) => {
                      if (e.target.value) void link(c.id, { goalId: e.target.value });
                    }}
                  >
                    <option value="">Цель…</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field"
                    defaultValue=""
                    disabled={busy}
                    onChange={(e) => {
                      if (e.target.value) void link(c.id, { principleId: e.target.value });
                    }}
                  >
                    <option value="">Принцип…</option>
                    {principles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {done.length > 0 ? (
        <section className="panel space-y-3">
          <WidgetHead title="Связаны" tone="violet" />
          <div className="stack-tight">
            {done.slice(0, 20).map((c) => (
              <div key={c.id} className="surface px-4 py-3">
                <p className="text-[14px] font-semibold">{c.raw}</p>
                <p className="mt-1 text-[12px] font-semibold text-[var(--ink-faint)]">
                  {[
                    c.directionId && dirs.find((d) => d.id === c.directionId)?.name,
                    c.goalId && goals.find((g) => g.id === c.goalId)?.title,
                    c.principleId && principles.find((p) => p.id === c.principleId)?.title,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
