import { createWorkPlan, ensureActivePlan, syncWorkPlanProgress } from "../lifeos";
import { normalizePlanCalendar, unlockNextPlanStep } from "../plan-calendar";
import type { LifeStore, PlanModule, PlanPhase, WorkPlan } from "../types";
import { id, now } from "../id";

function topics(titles: string[]): PlanModule[] {
  return titles.map((title, i) => ({
    id: id(),
    title,
    done: false,
    order: i + 1,
  }));
}

function stage(title: string, order: number, moduleTitles: string[]): PlanPhase {
  const modules = topics(moduleTitles);
  return {
    id: id(),
    title,
    order,
    status: order === 1 ? "active" : "planned",
    objectives: [],
    modules,
    milestones: modules,
    progress: 0,
  };
}

export const DIGITAL_ERASURE_META = {
  title: "Удаление себя из интернета",
  description:
    "Рабочий чек-лист: аккаунты → data brokers → поиск → телефон → утечки → Google → фото → почта → браузер → финальная проверка. Цель — сделать поиск по имени/номеру/email дорогим и сложным, без ложных гарантий полного исчезновения.",
  bucket: "foundation" as const,
};

/**
 * 10 этапов чек-листа → 4 фазы (по 3 этапа, последняя — финал).
 * Фаза 1: этапы 1–3 · Фаза 2: 4–6 · Фаза 3: 7–9 · Фаза 4: 10
 */
const STAGES: { title: string; topics: string[] }[] = [
  {
    title: "Этап 1. Удалить свои аккаунты",
    topics: [
      "Составить список всех используемых email",
      "Открыть менеджер паролей и выписать все зарегистрированные сервисы",
      "В почте поискать: verify / welcome / confirm / registration / подтвердите / регистрация",
      "Проверить SMS с кодами регистрации",
      "Проверить старые номера телефонов и старые email",
      "Открыть JustDeleteMe",
      "Перед удалением: фото, публикации, имя, телефон, доп. email, адрес, описание, платежи",
      "Удалить ненужные аккаунты",
      "Запросить полное удаление персональных данных, если есть опция",
      "Зафиксировать удалённые аккаунты в таблице аудита",
    ],
  },
  {
    title: "Этап 2. Data brokers + OSINT",
    topics: [
      "Spokeo: найти себя, проверить профили, скопировать URL, Opt-out, подтвердить, сохранить",
      "Spokeo: повторная проверка через несколько дней",
      "Whitepages: найти записи, Request removal, подтвердить, сохранить, перепроверить",
      "BeenVerified: страница Opt-out, запрос, подтверждение email, сохранить, перепроверить",
      "Найти другие people-search / data-broker базы с моими данными",
      "Для каждой записи: ФИО, телефон, email, город, адрес, связи, источник",
      "Отправить opt-out по каждой записи и зафиксировать результат",
    ],
  },
  {
    title: "Этап 3. Поисковики",
    topics: [
      'Google: "Имя Фамилия", +город, номер, email, старый username/ник',
      "Google: site:instagram.com / vk.com / facebook.com + имя",
      "Повторить поиск в Google, Bing, Яндекс и других релевантных",
      "Для каждого нежелательного результата: найти первоисточник",
      "Удалить данные на самом сайте, если доступ есть",
      "После удаления источника — запрос на обновление/удаление в поисковике",
      "Повторно проверить результаты (поисковик ≠ удаление с сайта)",
    ],
  },
  {
    title: "Этап 4. GetContact + телефон",
    topics: [
      "Проверить свой номер в GetContact и теги",
      "Проверить настройки видимости; запросить удаление/скрытие профиля",
      "Убедиться, что номер не отображается публично; повторить проверку позднее",
      "Проверить номер и старые номера через поисковики",
      "Проверить публичные объявления, форумы и сайты с номером",
    ],
  },
  {
    title: "Этап 5. Утечки данных",
    topics: [
      "Have I Been Pwned: основной и каждый старый email",
      "Зафиксировать утечки и какие данные скомпрометированы",
      "Сменить скомпрометированные пароли сразу",
      "Проверить повторное использование пароля и сменить везде",
      "Включить 2FA и уникальные пароли (утёкший пароль больше нигде не использовать)",
    ],
  },
  {
    title: "Этап 6. Google Activity",
    topics: [
      "My Activity: удалить данные за всё время по доступным продуктам",
      "Activity Controls: выключить историю веб-поиска и приложений",
      "Выключить историю местоположений и YouTube",
      "Проверить автоудаление данных и персонализацию",
    ],
  },
  {
    title: "Этап 7. Фотографии",
    topics: [
      "Проверить старые аватарки",
      "Reverse image search (Google Images, Bing Visual Search)",
      "Найти фото, загруженные другими; удалить свои публикации где есть доступ",
      "Попросить владельцев страниц удалить фото при необходимости",
      "Проверить старые аватарки поштучно",
    ],
  },
  {
    title: "Этап 8. Email",
    topics: [
      "Разделить почту: основной / обычные сервисы / alias",
      "Настроить SimpleLogin или аналог",
      "Alias для новых сервисов; не светить основной email без нужды",
      "Не один alias на десятки сервисов; отключать/удалять лишние",
    ],
  },
  {
    title: "Этап 9. Браузер и трекеры",
    topics: [
      "Выбрать браузер: Firefox или Brave",
      "Блокировка трекеров, сторонних cookies, fingerprinting где возможно",
      "Автоочистка истории/данных при необходимости; только нужные расширения",
      "Убрать лишние разрешения: геолокация, камера, микрофон, контакты",
    ],
  },
  {
    title: "Этап 10. Финальная проверка + таблица аудита",
    topics: [
      "Через 7–14 дней: ФИО и варианты написания, телефоны, email, username/ники",
      "Повторный поиск в Google, Bing, Яндекс",
      "Соцсети: Instagram, VK, Telegram, Facebook, TikTok, YouTube, старые",
      "Базы: Spokeo, Whitepages, BeenVerified, другие brokers, GetContact",
      "Фото: reverse search, аватарки, фото с другими",
      "Утечки: основной и старые email после смены паролей",
      "Заполнить таблицу аудита: аккаунты / email / телефон / brokers / соцсети / фото / поиск / утечки",
      "Принцип: что найдёт незнакомый по имени/номеру/email — довести до минимума",
    ],
  },
];

export function buildDigitalErasurePlan(owner: {
  ownerType: "goal" | "project";
  ownerId: string;
}): WorkPlan {
  const phases = STAGES.map((s, i) => stage(s.title, i + 1, s.topics));
  return createWorkPlan({
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    title: DIGITAL_ERASURE_META.title,
    desiredResult: DIGITAL_ERASURE_META.description,
    phases,
  });
}

/** Create goal + 10-stage checklist plan (idempotent). */
export function ensureDigitalErasureGoal(store: LifeStore): boolean {
  const { title, description, bucket } = DIGITAL_ERASURE_META;
  const existing = store.goals.find(
    (g) =>
      g.title === title ||
      /удал.*интернет/i.test(g.title) ||
      /digital\s*erasure|remove.*from.*internet/i.test(g.title)
  );
  if (existing?.workPlanId) {
    const wp = store.workPlans?.find((p) => p.id === existing.workPlanId);
    if (wp && wp.phases.length >= 10) {
      const modules = wp.phases.reduce((n, p) => n + (p.modules?.length ?? 0), 0);
      if (modules >= 40) return false;
    }
  }

  const career =
    store.spheres.find((s) => s.slug === "career") ??
    store.spheres.find((s) => /карьер|бизнес|безопасн/i.test(s.name));
  ensureActivePlan(store);
  const t = now();

  let goal = existing;
  if (!goal) {
    const nodeId = id();
    store.nodes.unshift({
      id: nodeId,
      kind: "goal",
      title,
      metadata: {},
      salience: 0.92,
      createdAt: t,
      updatedAt: t,
      sphereId: career?.id,
    });
    goal = {
      id: id(),
      nodeId,
      title,
      description,
      stages: [],
      progress: 0,
      active: true,
      archived: false,
      createdAt: t,
      lifeAreaId: career?.id,
      planId: ensureActivePlan(store).id,
      priority: "high",
      status: "active",
      horizonStage: 1,
      bucket,
    };
    store.goals.unshift(goal);
  } else {
    goal.title = title;
    goal.description = description;
    goal.horizonStage = goal.horizonStage ?? 1;
    goal.bucket = bucket;
    goal.active = true;
    goal.archived = false;
    goal.status = "active";
    if (career?.id) goal.lifeAreaId = career.id;
    if (goal.workPlanId) {
      store.workPlans = (store.workPlans ?? []).filter((p) => p.id !== goal!.workPlanId);
    }
  }

  const workPlan = buildDigitalErasurePlan({ ownerType: "goal", ownerId: goal.id });
  if (!store.workPlans) store.workPlans = [];
  normalizePlanCalendar(workPlan, store);
  // Keep checklist titles (don't wipe custom stage names).
  STAGES.forEach((s, i) => {
    const ph = workPlan.phases.find((p) => p.order === i + 1);
    if (ph) ph.title = s.title;
  });
  store.workPlans.push(workPlan);
  goal.workPlanId = workPlan.id;
  unlockNextPlanStep(store, workPlan.id);
  syncWorkPlanProgress(store, workPlan);

  return true;
}
