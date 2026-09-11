import { id, now } from "../id";
import type { Goal, LifeStore, PlanModule, PlanPhase, WorkPlan } from "../types";
import { createWorkPlan, ensureActivePlan } from "../lifeos";

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

export const DIGITAL_SECURITY_META = {
  title: "Цифровая безопасность, приватность, анонимность и OSINT",
  description:
    "Полностью пройти путь от новичка до уверенного понимания цифровой безопасности, приватности, анонимности и OSINT.",
  bucket: "foundation" as const,
};

const STAGES: { title: string; topics: string[] }[] = [
  {
    title: "Этап 1. База: понимание цифрового мира",
    topics: [
      "как работает интернет: IP, DNS, HTTP/HTTPS, браузер, сервер, трафик",
      "как работает телефон: прикладной процессор, базовый процессор, SIM-карта, IMEI, вышки сотовой связи",
      "что такое данные: активные данные, пассивные данные, метаданные, цифровой след",
      "кто следит: государство, оператор, корпорации, сервисы, злоумышленники",
    ],
  },
  {
    title: "Этап 2. Приватность и анонимность",
    topics: [
      "что такое приватность",
      "что такое анонимность",
      "разница между приватностью и анонимностью",
      "модель угроз",
      "что важнее: приватность или анонимность",
    ],
  },
  {
    title: "Этап 3. Цифровая гигиена",
    topics: [
      "пароли и менеджеры паролей",
      "двухфакторная аутентификация",
      "безопасная почта",
      "защита номера телефона",
      "обновления устройств",
      "минимизация приложений",
      "шифрование диска",
    ],
  },
  {
    title: "Этап 4. Мессенджеры",
    topics: [
      "Telegram: обычные чаты, секретные чаты, настройки приватности",
      "двухшаговая проверка в Telegram",
      "BotFather и удаление ботов",
      "Signal",
      "Wickr",
      "WhatsApp и его риски",
      "Viber и почему его лучше не использовать",
    ],
  },
  {
    title: "Этап 5. SIM-карты и номера",
    topics: [
      "официальная SIM и её риски",
      "серая SIM",
      "корпоративная SIM",
      "eSIM",
      "аренда номеров",
      "одноразовые номера",
      "оплата криптовалютой",
    ],
  },
  {
    title: "Этап 6. VPN и Tor",
    topics: [
      "как работает VPN",
      "что VPN скрывает",
      "что VPN не скрывает",
      "выбор VPN",
      "двойной VPN",
      "обфускация",
      "как работает Tor",
      "Tor Browser",
      "связка VPN и Tor",
    ],
  },
  {
    title: "Этап 7. Чистое устройство для анонимности",
    topics: [
      "отдельный телефон",
      "отдельный компьютер",
      "виртуальная машина",
      "антидетект-браузер",
      "чистая почта",
      "чистая среда",
    ],
  },
  {
    title: "Этап 8. Финансовая анонимность",
    topics: [
      "Bitcoin и Monero",
      "разница между прозрачной и анонимной криптовалютой",
      "покупка Monero без KYC",
      "виртуальные карты",
      "анонимные платежи",
    ],
  },
  {
    title: "Этап 9. OSINT",
    topics: [
      "поиск по номеру телефона",
      "поиск по email",
      "поиск по фото",
      "поиск по нику",
      "Telegram OSINT",
      "метаданные и EXIF",
      "проверка себя",
    ],
  },
  {
    title: "Этап 10. Утечки данных",
    topics: [
      "как происходят утечки",
      "где искать утечки",
      "как проверять себя",
      "почему данные невозможно удалить полностью",
    ],
  },
  {
    title: "Этап 11. Вредоносное ПО",
    topics: [
      "вирусы",
      "трояны",
      "шпионское ПО",
      "майнеры",
      "программы-вымогатели",
      "как заражаются устройства",
      "защита от вредоносного ПО",
    ],
  },
  {
    title: "Этап 12. Социальная инженерия",
    topics: [
      "фишинг",
      "поддельные сайты",
      "манипуляции",
      "давление и срочность",
      "защита от обмана",
    ],
  },
  {
    title: "Этап 13. Даркнет",
    topics: [
      "Deep Web и Darknet",
      "разница между ними",
      "как зайти",
      "риски",
      "мошенничество",
      "зачем это изучать",
    ],
  },
  {
    title: "Этап 14. Кибербезопасность как сфера",
    topics: [
      "Red Team",
      "Blue Team",
      "SOC",
      "OSINT-специалисты",
      "Forensics",
      "Kali Linux",
      "Maltego",
      "Metasploit",
      "Nmap",
      "CTF",
    ],
  },
  {
    title: "Этап 15. Практика и проверка себя",
    topics: [
      "OSINT-проверка себя",
      "поиск своих утечек",
      "чистка старых аккаунтов",
      "смена паролей",
      "создание чистой среды",
      "применение всех знаний",
    ],
  },
  {
    title: "Этап 16. Постоянное развитие",
    topics: [
      "отслеживание новостей безопасности",
      "обновление знаний",
      "пересмотр модели угроз",
      "практика",
      "бдительность",
    ],
  },
];

export function buildDigitalSecurityPlan(owner: {
  ownerType: "goal" | "project";
  ownerId: string;
}): WorkPlan {
  const phases = STAGES.map((s, i) => stage(s.title, i + 1, s.topics));
  return createWorkPlan({
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    title: DIGITAL_SECURITY_META.title,
    desiredResult: DIGITAL_SECURITY_META.description,
    deadline: "2026-10-31",
    phases,
  });
}

/** Create goal + 16-stage plan in foundation bucket (idempotent). */
export function ensureDigitalSecurityGoal(store: LifeStore): boolean {
  const { title, description, bucket } = DIGITAL_SECURITY_META;
  const existing = store.goals.find(
    (g) =>
      g.title === title ||
      (/цифров.*безопасност/i.test(g.title) && /osint/i.test(g.title))
  );
  if (existing?.workPlanId) {
    const wp = store.workPlans?.find((p) => p.id === existing.workPlanId);
    if (wp && wp.phases.length >= 16) return false;
  }

  const career =
    store.spheres.find((s) => s.slug === "career") ??
    store.spheres.find((s) => /карьер|бизнес/i.test(s.name));
  const plan = ensureActivePlan(store);
  const t = now();

  let goal = existing;
  if (!goal) {
    const nodeId = id();
    store.nodes.unshift({
      id: nodeId,
      kind: "goal",
      title,
      metadata: {},
      salience: 0.9,
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
      planId: plan.id,
      priority: "high",
      status: "active",
      horizonStage: 1,
      bucket,
      deadline: "2026-10-31",
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

  const workPlan = buildDigitalSecurityPlan({ ownerType: "goal", ownerId: goal.id });
  if (!store.workPlans) store.workPlans = [];
  store.workPlans.push(workPlan);
  goal.workPlanId = workPlan.id;

  return true;
}
