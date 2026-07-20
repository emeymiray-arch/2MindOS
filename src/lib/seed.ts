import { id, now, todayKey } from "./id";
import type { LifeStore } from "./types";

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createSeedStore(): LifeStore {
  const t = now();
  const date = todayKey();

  const spheres = [
    { id: id(), slug: "work", name: "Работа", order: 1, kpiLabel: "Фокус", kpiValue: "Высокий" },
    { id: id(), slug: "ai-company", name: "AI-компания", order: 2, kpiLabel: "MVP", kpiValue: "В работе" },
    { id: id(), slug: "restaurant", name: "Ресторан", order: 3, kpiLabel: "Стадия", kpiValue: "Концепт" },
    { id: id(), slug: "education", name: "Самообразование", order: 4 },
    { id: id(), slug: "reading", name: "Чтение", order: 5 },
    { id: id(), slug: "quran", name: "Коран", order: 6 },
    { id: id(), slug: "tajweed", name: "Таджвид", order: 7 },
    { id: id(), slug: "english", name: "Английский", order: 8 },
    { id: id(), slug: "programming", name: "Программирование", order: 9 },
    { id: id(), slug: "health", name: "Здоровье", order: 10 },
    { id: id(), slug: "finance", name: "Финансы", order: 11 },
    { id: id(), slug: "habits", name: "Привычки", order: 12 },
    { id: id(), slug: "dreams", name: "Мечты", order: 13 },
    { id: id(), slug: "skills", name: "Навыки", order: 14 },
    { id: id(), slug: "relations", name: "Отношения", order: 15 },
    { id: id(), slug: "growth", name: "Личный рост", order: 16 },
    { id: id(), slug: "history", name: "История", order: 17 },
    { id: id(), slug: "literature", name: "Литература", order: 18 },
    { id: id(), slug: "knowledge", name: "Знания", order: 19 },
  ];

  const sphere = (slug: string) => spheres.find((s) => s.slug === slug)!.id;

  const goalDayNode = {
    id: id(),
    kind: "goal" as const,
    title: "Закрыть архитектуру 2MindOS",
    body: "Довести ядро графа и Command Center до рабочего состояния.",
    sphereId: sphere("ai-company"),
    metadata: { horizon: "day" },
    salience: 1,
    createdAt: t,
    updatedAt: t,
  };
  const goalWeekNode = {
    id: id(),
    kind: "goal" as const,
    title: "Запустить личный Life OS",
    body: "MVP: захват мыслей, граф, vitals, один проект-компания.",
    sphereId: sphere("ai-company"),
    metadata: { horizon: "week" },
    salience: 0.95,
    createdAt: t,
    updatedAt: t,
  };
  const goalMonthNode = {
    id: id(),
    kind: "goal" as const,
    title: "Система вместо хаоса",
    body: "Каждая сфера жизни имеет аналитику и связанные объекты.",
    sphereId: sphere("growth"),
    metadata: { horizon: "month" },
    salience: 0.9,
    createdAt: t,
    updatedAt: t,
  };
  const goalYearNode = {
    id: id(),
    kind: "goal" as const,
    title: "Жизнь как корпорация",
    body: "Построить операционную систему жизни с AI-стратегом.",
    sphereId: sphere("growth"),
    metadata: { horizon: "year" },
    salience: 0.85,
    createdAt: t,
    updatedAt: t,
  };

  const habitWaterNode = {
    id: id(),
    kind: "habit" as const,
    title: "Вода",
    body: "2.5 л в день",
    sphereId: sphere("health"),
    metadata: {},
    salience: 0.8,
    createdAt: t,
    updatedAt: t,
  };
  const habitSleepNode = {
    id: id(),
    kind: "habit" as const,
    title: "Сон до 23:30",
    sphereId: sphere("health"),
    metadata: {},
    salience: 0.8,
    createdAt: t,
    updatedAt: t,
  };
  const habitReadNode = {
    id: id(),
    kind: "habit" as const,
    title: "Чтение 30 мин",
    sphereId: sphere("reading"),
    metadata: {},
    salience: 0.75,
    createdAt: t,
    updatedAt: t,
  };
  const habitTajweedNode = {
    id: id(),
    kind: "habit" as const,
    title: "Таджвид",
    sphereId: sphere("tajweed"),
    metadata: {},
    salience: 0.85,
    createdAt: t,
    updatedAt: t,
  };

  const projectNode = {
    id: id(),
    kind: "project" as const,
    title: "AI-компания",
    body: "Личный дивизион: продукты на базе ИИ.",
    sphereId: sphere("ai-company"),
    metadata: {},
    salience: 0.95,
    createdAt: t,
    updatedAt: t,
  };

  const restaurantNode = {
    id: id(),
    kind: "project" as const,
    title: "Ресторан быстрого питания",
    body: "Будущий бренд QSR.",
    sphereId: sphere("restaurant"),
    metadata: {},
    salience: 0.7,
    createdAt: t,
    updatedAt: t,
  };

  const thought1 = {
    id: id(),
    kind: "thought" as const,
    title: "Хочу фотосессию в горах",
    body: "Хочу фотосессию в горах",
    sphereId: sphere("dreams"),
    metadata: {},
    salience: 0.7,
    createdAt: t,
    updatedAt: t,
  };
  const placeDombay = {
    id: id(),
    kind: "place" as const,
    title: "Домбай",
    body: "Еду в Домбай",
    sphereId: sphere("dreams"),
    metadata: {},
    salience: 0.75,
    createdAt: t,
    updatedAt: t,
  };
  const dress = {
    id: id(),
    kind: "dream" as const,
    title: "Купить платье",
    body: "Купить платье для съёмки",
    sphereId: sphere("dreams"),
    metadata: {},
    salience: 0.65,
    createdAt: t,
    updatedAt: t,
  };
  const reels = {
    id: id(),
    kind: "idea" as const,
    title: "Снять Reels",
    body: "Снять Reels с фотосессии",
    sphereId: sphere("ai-company"),
    metadata: {},
    salience: 0.7,
    createdAt: t,
    updatedAt: t,
  };
  const content = {
    id: id(),
    kind: "idea" as const,
    title: "Контент",
    body: "Контент-линия вокруг путешествия",
    sphereId: sphere("ai-company"),
    metadata: {},
    salience: 0.68,
    createdAt: t,
    updatedAt: t,
  };

  const bookNode = {
    id: id(),
    kind: "book" as const,
    title: "Атомные привычки",
    body: "James Clear",
    sphereId: sphere("reading"),
    metadata: { author: "James Clear" },
    salience: 0.6,
    createdAt: t,
    updatedAt: t,
  };

  const skillEng = {
    id: id(),
    kind: "skill" as const,
    title: "Английский",
    sphereId: sphere("english"),
    metadata: {},
    salience: 0.7,
    createdAt: t,
    updatedAt: t,
  };
  const skillCode = {
    id: id(),
    kind: "skill" as const,
    title: "Программирование",
    sphereId: sphere("programming"),
    metadata: {},
    salience: 0.75,
    createdAt: t,
    updatedAt: t,
  };

  const wishTravel = {
    id: id(),
    kind: "dream" as const,
    title: "Фотосессия в горах",
    sphereId: sphere("dreams"),
    metadata: { category: "travel" },
    salience: 0.8,
    createdAt: t,
    updatedAt: t,
  };

  const edges = [
    {
      id: id(),
      sourceId: thought1.id,
      targetId: placeDombay.id,
      type: "leads_to" as const,
      weight: 1,
      provenance: "rule" as const,
      confidence: 0.92,
      createdAt: t,
    },
    {
      id: id(),
      sourceId: placeDombay.id,
      targetId: dress.id,
      type: "leads_to" as const,
      weight: 1,
      provenance: "rule" as const,
      confidence: 0.88,
      createdAt: t,
    },
    {
      id: id(),
      sourceId: dress.id,
      targetId: reels.id,
      type: "leads_to" as const,
      weight: 1,
      provenance: "rule" as const,
      confidence: 0.85,
      createdAt: t,
    },
    {
      id: id(),
      sourceId: reels.id,
      targetId: content.id,
      type: "part_of" as const,
      weight: 1,
      provenance: "rule" as const,
      confidence: 0.9,
      createdAt: t,
    },
    {
      id: id(),
      sourceId: thought1.id,
      targetId: wishTravel.id,
      type: "derived_from" as const,
      weight: 1,
      provenance: "rule" as const,
      confidence: 0.8,
      createdAt: t,
    },
    {
      id: id(),
      sourceId: projectNode.id,
      targetId: content.id,
      type: "supports" as const,
      weight: 0.7,
      provenance: "ai" as const,
      confidence: 0.72,
      createdAt: t,
    },
  ];

  return {
    version: 1,
    spheres,
    nodes: [
      goalDayNode,
      goalWeekNode,
      goalMonthNode,
      goalYearNode,
      habitWaterNode,
      habitSleepNode,
      habitReadNode,
      habitTajweedNode,
      projectNode,
      restaurantNode,
      thought1,
      placeDombay,
      dress,
      reels,
      content,
      bookNode,
      skillEng,
      skillCode,
      wishTravel,
    ],
    edges,
    captures: [],
    goals: [
      {
        id: id(),
        nodeId: goalDayNode.id,
        title: "Усидеть на работе / 2MindOS",
        
        deadline: date,
        stages: [
          { id: id(), title: "Создать сайт", done: false, deadlineStart: date, deadlineEnd: addDays(date, 6), order: 1 },
          { id: id(), title: "Инста — продвигать", done: false, deadlineStart: date, deadlineEnd: addDays(date, 13), order: 2 },
          { id: id(), title: "Закрыть архитектуру", done: true, deadlineStart: date, deadlineEnd: addDays(date, 2), order: 3 },
        ],
        progress: 33,
        active: true,
        createdAt: t,
        horizon: "day",
      },
      {
        id: id(),
        nodeId: goalWeekNode.id,
        title: "Запустить личный Life OS",
        
        stages: [
          { id: id(), title: "Command + задачи из этапов", done: false, deadlineStart: date, deadlineEnd: date, order: 1 },
          { id: id(), title: "Wish + категории", done: false, deadlineStart: date, deadlineEnd: date, order: 2 },
        ],
        progress: 0,
        active: true,
        createdAt: t,
        horizon: "week",
      },
      {
        id: id(),
        nodeId: skillEng.id,
        title: "Английский speaking",
        
        stages: [
          { id: id(), title: "15 мин speaking", done: false, deadlineStart: date, deadlineEnd: date, order: 1 },
        ],
        progress: 0,
        active: true,
        createdAt: t,
      },
      {
        id: id(),
        nodeId: wishTravel.id,
        title: "Купить платье для съёмки",
        
        stages: [
          { id: id(), title: "Выбрать модель", done: false, deadlineStart: date, deadlineEnd: date, order: 1 },
          { id: id(), title: "Оформить заказ", done: false, order: 2 },
        ],
        progress: 0,
        active: true,
        createdAt: t,
      },
    ],
    habits: [
      { id: id(), nodeId: habitWaterNode.id, title: "Вода", targetPerDay: 2500, unit: "мл", streak: 3, active: true },
      { id: id(), nodeId: habitSleepNode.id, title: "Сон до 23:30", targetPerDay: 1, streak: 2, active: true },
      { id: id(), nodeId: habitReadNode.id, title: "Чтение 30 мин", targetPerDay: 1, streak: 5, active: true },
      { id: id(), nodeId: habitTajweedNode.id, title: "Таджвид", targetPerDay: 1, streak: 4, active: true },
    ],
    habitLogs: [],
    vitals: [
      {
        date,
        waterMl: 1200,
        waterTargetMl: 2500,
        sleepHours: 6.5,
        sleepTargetHours: 8,
        mood: 7,
        healthScore: 72,
        prayers: { fajr: true, dhuhr: true, asr: false, maghrib: false, isha: false },
      },
    ],
    projects: [
      {
        id: id(),
        nodeId: projectNode.id,
        name: "AI-компания",
        tagline: "Продукты интеллекта как дивизион жизни",
        status: "active",
        kpi: [
          { label: "Продуктов в работе", value: "1" },
          { label: "Идей в воронке", value: "12" },
          { label: "Фокус недели", value: "2MindOS" },
        ],
        modules: {
          docs: ["Vision 2MindOS", "Онтология Life Graph", "Дизайн-система Obsidian Atelier"],
          tasks: [
            { id: id(), title: "Command Center", done: true },
            { id: id(), title: "Автосвязи графа", done: false },
            { id: id(), title: "Oracle tool-calling", done: false },
          ],
          ideas: ["Shortcuts gallery", "Reading Lab SRS", "Wish Tree auto-breakdown"],
          financeNotes: ["Бюджет инфраструктуры: Vercel + AI"],
          team: ["Вы — CEO", "AI — стратег"],
          marketing: ["Контент из реальной жизни", "Reels из Домбая"],
          sales: ["Личный use-case → продукт"],
          files: ["architecture.md"],
          changelog: [
            { at: t, text: "Инициализация компании внутри Life OS" },
            { at: t, text: "Seed кластера «фотосессия → Домбай»" },
          ],
        },
        diary: [
          { id: id(), kind: "idea", title: "Shortcuts gallery", body: "Галерея Apple Shortcuts для vitals", createdAt: t },
          { id: id(), kind: "rule", title: "Один MIT в день", body: "Не распыляться на ресторан пока AI-дивизион не стабилен", createdAt: t },
        ],
      },
      {
        id: id(),
        nodeId: restaurantNode.id,
        name: "Ресторан быстрого питания",
        tagline: "Будущий QSR-бренд",
        status: "paused",
        kpi: [
          { label: "Стадия", value: "Концепт" },
          { label: "Локаций", value: "0" },
        ],
        modules: {
          docs: ["Концепт кухни", "Целевой гость"],
          tasks: [{ id: id(), title: "Собрать референсы меню", done: false }],
          ideas: ["Скорость + эстетика подачи"],
          financeNotes: ["Капитальные затраты — TBD"],
          team: [],
          marketing: ["Локальный бренд"],
          sales: [],
          files: [],
          changelog: [{ at: t, text: "Проект создан как дивизион" }],
        },
        diary: [],
      },
    ],
    books: [
      {
        id: id(),
        nodeId: bookNode.id,
        title: "Атомные привычки",
        author: "James Clear",
        progress: 35,
        chapters: [
          {
            id: id(),
            title: "Сила малых улучшений",
            order: 1,
            insights: [
              { id: id(), kind: "idea", text: "1% лучше каждый день → 37× за год" },
              { id: id(), kind: "apply", text: "Применить к таджвиду и воде: маленькие ежедневные победы" },
              { id: id(), kind: "quote", text: "You do not rise to the level of your goals. You fall to the level of your systems." },
            ],
          },
        ],
      },
    ],
    reviewCards: [
      {
        id: id(),
        bookId: "",
        question: "Что важнее: цель или система?",
        answer: "Система. Цели задают направление, системы дают прогресс.",
        ease: 2.5,
        interval: 2,
        repetitions: 0,
        nextReviewAt: date,
      },
    ],
    skills: [
      {
        id: id(),
        nodeId: skillEng.id,
        name: "Английский",
        level: 4,
        xp: 320,
        xpToNext: 500,
        subskills: [
          { name: "Speaking", level: 3 },
          { name: "Listening", level: 4 },
          { name: "Writing", level: 4 },
        ],
      },
      {
        id: id(),
        nodeId: skillCode.id,
        name: "Программирование",
        level: 6,
        xp: 780,
        xpToNext: 1000,
        subskills: [
          { name: "TypeScript", level: 6 },
          { name: "Product", level: 5 },
          { name: "AI systems", level: 4 },
        ],
      },
    ],
    stageDayLogs: [],
    dayTasks: [],
    wishBlocks: [
      {
        id: id(),
        hashtag: "волосы",
        bucket: "material",
        nodeId: id(),
        createdAt: t,
        items: [
          { id: id(), title: "Фен", done: false },
          { id: id(), title: "Маска для волос", done: false },
        ],
      },
      {
        id: id(),
        hashtag: "спорт",
        bucket: "skill",
        nodeId: id(),
        createdAt: t,
        items: [
          { id: id(), title: "Форма", done: false },
          { id: id(), title: "Кроссовки", done: false },
        ],
      },
      {
        id: id(),
        hashtag: "книги",
        bucket: "plans",
        nodeId: wishTravel.id,
        createdAt: t,
        items: [
          { id: id(), title: "Атомные привычки — дочитать", done: false },
        ],
      },
    ],
    thoughtJournals: [
      {
        id: id(),
        title: "Мысли из книг",
        createdAt: t,
        entries: [
          { id: id(), word: "Система", body: "Цели задают направление, системы дают прогресс.", date },
        ],
      },
      { id: id(), title: "Мои мысли", createdAt: t, entries: [] },
      { id: id(), title: "Мои цитаты", createdAt: t, entries: [] },
      { id: id(), title: "Мой дневник", createdAt: t, entries: [] },
    ],
    finance: {
      incomeMonth: 120000,
      expensesMonth: 45000,
      mandatoryMonth: 35000,
      cushion: 80000,
      debts: 0,
      currency: "RUB",
      subscriptions: [
        { name: "Cursor", amount: 2000 },
        { name: "Claude", amount: 1500 },
      ],
      goals: [{ title: "Подушка 6 месяцев", target: 600000, current: 80000 }],
      transactions: [
        { id: id(), type: "income", title: "Основной доход", amount: 120000, date },
        { id: id(), type: "mandatory", title: "Жильё", amount: 25000, date },
        { id: id(), type: "mandatory", title: "Еда", amount: 10000, date },
        { id: id(), type: "expense", title: "Прочее", amount: 45000, date },
        { id: id(), type: "savings", title: "В копилку", amount: 15000, date },
      ],
    },
    calendarEvents: [
      { id: id(), title: "Созвон по AI-проекту", date, note: "Не пропускать", important: true },
    ],
    passwords: [
      {
        id: id(),
        projectName: "2MindOS",
        title: "Supabase",
        username: "admin",
        secret: "••••••••",
        notes: "DB + API",
        createdAt: t,
        updatedAt: t,
      },
    ],
    oracleMessages: [
      {
        id: id(),
        role: "assistant",
        content:
          "Слабое место недели — сон (6.5 ч при цели 8). Вода на 48%. Кластер «Домбай» уже связан: фотосессия → место → платье → Reels → контент. Сегодняшний MIT совпадает с дивизионом AI-компании.",
        createdAt: t,
        contextUsed: ["vitals", "graph", "goals"],
      },
    ],
    settings: {
      shortcutsToken: "mindos-local-token",
      yearProgressNote: "Год строительства системы. 8% пути.",
      mit: "Закрыть архитектуру 2MindOS",
      theme: "light",
      language: "ru",
      startOfWeek: 1,
      notifications: true,
      sound: false,
      reduceMotion: false,
      compactMode: false,
      showArchived: false,
      name: "",
      email: "",
    },
  };
}

/** Clean slate for Settings → Reset (not demo seed). */
export function createEmptyStore(): LifeStore {
  const t = now();
  return {
    version: 4,
    spheres: [],
    nodes: [],
    edges: [],
    captures: [],
    goals: [],
    stageDayLogs: [],
    dayTasks: [],
    habits: [],
    habitLogs: [],
    vitals: [],
    projects: [],
    books: [],
    reviewCards: [],
    skills: [],
    wishBlocks: [],
    thoughtJournals: [
      { id: id(), title: "Мысли из книг", entries: [], createdAt: t },
      { id: id(), title: "Мои мысли", entries: [], createdAt: t },
      { id: id(), title: "Мои цитаты", entries: [], createdAt: t },
      { id: id(), title: "Мой дневник", entries: [], createdAt: t },
    ],
    finance: {
      incomeMonth: 0,
      expensesMonth: 0,
      mandatoryMonth: 0,
      cushion: 0,
      debts: 0,
      currency: "RUB",
      subscriptions: [],
      goals: [],
      transactions: [],
    },
    calendarEvents: [],
    passwords: [],
    oracleMessages: [],
    settings: {
      shortcutsToken: "mindos-local-token",
      yearProgressNote: "",
      mit: "",
      theme: "light",
      language: "ru",
      startOfWeek: 1,
      notifications: true,
      sound: false,
      reduceMotion: false,
      compactMode: false,
      showArchived: false,
      name: "",
      email: "",
    },
  };
}
