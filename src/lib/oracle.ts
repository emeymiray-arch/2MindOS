import type { LifeStore } from "./types";
import { id, now, todayKey } from "./id";

export function getTodayVitals(store: LifeStore) {
  const date = todayKey();
  let vitals = store.vitals.find((v) => v.date === date);
  if (!vitals) {
    vitals = {
      date,
      waterMl: 0,
      waterTargetMl: 2500,
      sleepHours: 0,
      sleepTargetHours: 8,
      mood: undefined,
      healthScore: undefined,
      prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
    };
    store.vitals.push(vitals);
  }
  return vitals;
}

export function prayerProgress(vitals: LifeStore["vitals"][0]): number {
  const vals = Object.values(vitals.prayers);
  return vals.filter(Boolean).length;
}

export function buildOracleContext(store: LifeStore): string {
  const vitals = getTodayVitals(store);
  const goals = store.goals.filter((g) => g.active);
  const day = goals.find((g) => g.horizon === "day");
  const week = goals.find((g) => g.horizon === "week");
  const recentThoughts = store.nodes
    .filter((n) => n.kind === "thought" || n.kind === "idea" || n.kind === "dream")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map((n) => `- [${n.kind}] ${n.title}`)
    .join("\n");

  const weak: string[] = [];
  if (vitals.sleepHours > 0 && vitals.sleepHours < vitals.sleepTargetHours) {
    weak.push(`сон ${vitals.sleepHours}ч / ${vitals.sleepTargetHours}ч`);
  }
  if (vitals.waterMl < vitals.waterTargetMl * 0.6) {
    weak.push(`вода ${vitals.waterMl}мл / ${vitals.waterTargetMl}мл`);
  }
  const prayersDone = prayerProgress(vitals);
  if (prayersDone < 5) weak.push(`намаз ${prayersDone}/5`);

  const clusters = store.edges
    .filter((e) => e.confidence >= 0.8)
    .slice(0, 6)
    .map((e) => {
      const s = store.nodes.find((n) => n.id === e.sourceId)?.title;
      const t = store.nodes.find((n) => n.id === e.targetId)?.title;
      return `${s} —[${e.type}]→ ${t}`;
    })
    .join("\n");

  return [
    `MIT: ${store.settings.mit}`,
    `Цель дня: ${day?.title ?? "—"} (${day?.progress ?? 0}%)`,
    `Цель недели: ${week?.title ?? "—"}`,
    `Vitals: вода ${vitals.waterMl}/${vitals.waterTargetMl}, сон ${vitals.sleepHours}/${vitals.sleepTargetHours}, намаз ${prayersDone}/5`,
    `Слабые места: ${weak.length ? weak.join(", ") : "нет явных"}`,
    `Год: ${store.settings.yearProgressNote}`,
    `Финансы: доход ${store.finance.incomeMonth}, расход ${store.finance.expensesMonth}, подушка ${store.finance.cushion}`,
    `Свежие мысли:\n${recentThoughts || "—"}`,
    `Сильные связи:\n${clusters || "—"}`,
  ].join("\n");
}

export function localOracleReply(store: LifeStore, question: string): {
  content: string;
  contextUsed: string[];
} {
  const ctx = buildOracleContext(store);
  const vitals = getTodayVitals(store);
  const q = question.toLowerCase();

  let content: string;

  if (/сон|спать|устала/.test(q)) {
    content = `Сон сейчас ${vitals.sleepHours}ч при цели ${vitals.sleepTargetHours}ч. Это главный тормоз недели. Рекомендация: зафиксировать отбой до 23:30 как MIT на завтра и снизить вечерний экран после 22:00. Связанные привычки уже в системе.`;
  } else if (/вод|пить/.test(q)) {
    content = `Вода: ${vitals.waterMl} из ${vitals.waterTargetMl} мл. До цели осталось ${Math.max(0, vitals.waterTargetMl - vitals.waterMl)} мл. Быстрое действие: +250 мл через Shortcuts.`;
  } else if (/домбай|фотосесс|платье|reels|контент/.test(q)) {
    content =
      "Кластер «горы» уже собран в графе: фотосессия → Домбай → платье → Reels → контент. Следующий физический шаг — «Купить платье». Это разблокирует съёмку и контент-линию для AI-дивизиона.";
  } else if (/деньг|купи|финанс|трат/.test(q)) {
    content = `Финансовый контур: доход ${store.finance.incomeMonth} ${store.finance.currency}, расходы ${store.finance.expensesMonth}, подушка ${store.finance.cushion}, долги ${store.finance.debts}. Решение о крупной покупке принимай только если оно поддерживает активную цель недели или Wish Tree, иначе — отложить.`;
  } else if (/что.*важн|сегодня|фокус|mit/.test(q)) {
    content = `Главный фокус: «${store.settings.mit}». Цель дня совпадает с дивизионом AI-компании. Не распыляйся на ресторанный проект сегодня — он на паузе.`;
  } else {
    content = `Учитывая систему:\n\n${summarizeForAnswer(store)}\n\nПо запросу «${question.trim()}»: действуй через граф — сначала найди связанный объект, затем один следующий шаг. Если решение затрагивает деньги или здоровье — сверь с vitals и финансами перед коммитом.`;
  }

  // Append one weakness always
  if (vitals.sleepHours < vitals.sleepTargetHours) {
    content += "\n\nПредупреждение: недосып снижает качество решений — не планируй тяжёлые выборы после 21:00.";
  }

  return {
    content,
    contextUsed: ["vitals", "goals", "graph", "finance", "mit"],
  };
}

function summarizeForAnswer(store: LifeStore): string {
  const day = store.goals.find((g) => g.horizon === "day" && g.active);
  const prayers = prayerProgress(getTodayVitals(store));
  return `MIT «${store.settings.mit}»; день: ${day?.title}; намаз ${prayers}/5; узлов в графе ${store.nodes.length}; связей ${store.edges.length}.`;
}

export async function oracleAnswer(
  store: LifeStore,
  question: string
): Promise<{ content: string; contextUsed: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return localOracleReply(store, question);
  }

  try {
    const { generateText } = await import("ai");
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const anthropic = createAnthropic({ apiKey });
    const context = buildOracleContext(store);

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: `Ты — Oracle внутри 2MindOS, личной операционной системы жизни. Ты CFO и стратег. Отвечай по-русски, коротко, дорого, без воды. Опирайся только на контекст системы. Если данных мало — скажи, чего не хватает.`,
      prompt: `Контекст системы:\n${context}\n\nВопрос:\n${question}`,
    });

    return { content: text, contextUsed: ["vitals", "goals", "graph", "finance", "ai"] };
  } catch {
    return localOracleReply(store, question);
  }
}

export function pushOracleMessage(
  store: LifeStore,
  role: "user" | "assistant",
  content: string,
  contextUsed?: string[]
) {
  store.oracleMessages.push({
    id: id(),
    role,
    content,
    createdAt: now(),
    contextUsed,
  });
  if (store.oracleMessages.length > 40) {
    store.oracleMessages = store.oracleMessages.slice(-40);
  }
}
