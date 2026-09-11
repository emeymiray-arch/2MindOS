# 2Mind OS v2

Дочерний проект полного редизайна 2Mind OS.

- Использует **ту же базу данных** (LifeStore JSON vault + Supabase `lifeos_snapshots`)
- Не ломает parent-приложение `/Users/marammurtazova/2MindOS`
- UI: русский · цикл Цель → План → Месяц → Неделя → Сегодня → Plan vs Reality

```bash
npm install
npm run dev
```

По умолчанию порт 3000. Если parent уже запущен — `npm run dev -- -p 3001`.
