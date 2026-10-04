"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";

type Step = 0 | 1 | 2 | 3;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [vision, setVision] = useState("");
  const [goal, setGoal] = useState("");
  const [habit, setHabit] = useState("");

  async function finish(markDone = true) {
    if (markDone) {
      await apiPost("/api/state", {
        action: "settings",
        settings: { onboardingDone: true },
      });
    }
    onDone();
  }

  async function saveVision() {
    setBusy(true);
    if (vision.trim()) {
      const res = await apiPost("/api/life", {
        action: "setVision",
        visionNote: vision.trim(),
      });
      if (!res.ok) {
        setBusy(false);
        toast(res.error ?? "Не сохранилось", "warn");
        return;
      }
    }
    setBusy(false);
    setStep(2);
  }

  async function saveGoal() {
    const title = goal.trim();
    if (!title) {
      setStep(3);
      return;
    }
    setBusy(true);
    const res = await apiPost("/api/goals", { action: "create", title });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не создалось", "warn");
      return;
    }
    setStep(3);
  }

  async function saveHabit() {
    const title = habit.trim();
    setBusy(true);
    if (title) {
      const res = await apiPost("/api/habits", { action: "create", title });
      if (!res.ok) {
        setBusy(false);
        toast(res.error ?? "Не создалось", "warn");
        return;
      }
    }
    await finish(true);
    setBusy(false);
    toast("Готово — можно пользоваться", "ok");
  }

  return (
    <div className="onboard-overlay">
      <div className="onboard-card surface space-y-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
            Знакомство · {step + 1}/4
          </p>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void finish(true)}
          >
            Пропустить
          </button>
        </div>

        {step === 0 ? (
          <>
            <h1 className="font-display text-[1.9rem] leading-tight">Добро пожаловать в 2Mind</h1>
            <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">
              Личный кабинет для целей, планов, привычек и финансов. Данные только вашего профиля —
              их можно экспортировать в настройках.
            </p>
            <button type="button" className="btn btn-primary w-full" onClick={() => setStep(1)}>
              Начать
            </button>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="font-display text-[1.6rem]">Фокус периода</h2>
            <p className="text-[14px] text-[var(--ink-soft)]">
              Одна короткая фраза — к чему идёте сейчас.
            </p>
            <textarea
              className="field resize-none"
              rows={3}
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              placeholder="Например: ясное тело, спокойная речь, сильное дело"
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => setStep(2)} disabled={busy}>
                Позже
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={busy}
                onClick={() => void saveVision()}
              >
                Дальше
              </button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="font-display text-[1.6rem]">Первая цель</h2>
            <p className="text-[14px] text-[var(--ink-soft)]">
              То, к чему хотите прийти. План можно дописать потом.
            </p>
            <input
              className="field"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Например: восстановить силу тела"
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => setStep(3)} disabled={busy}>
                Позже
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={busy}
                onClick={() => void saveGoal()}
              >
                Дальше
              </button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="font-display text-[1.6rem]">Первая привычка</h2>
            <p className="text-[14px] text-[var(--ink-soft)]">
              Маленькое ежедневное действие — можно пропустить.
            </p>
            <input
              className="field"
              value={habit}
              onChange={(e) => setHabit(e.target.value)}
              placeholder="Например: зарядка 10 минут"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="btn flex-1"
                disabled={busy}
                onClick={() => void finish(true)}
              >
                Готово
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={busy}
                onClick={() => void saveHabit()}
              >
                Сохранить
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
