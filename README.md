# 2MindOS

Personal Life Operating System — второй мозг, не ежедневник.

## Запуск

```bash
npm install
cp .env.example .env.local
npm run dev
```

Откройте [http://127.0.0.1:3001](http://127.0.0.1:3001) (или порт из терминала).

## Env

В `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL из Supabase Dashboard → Settings → API
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` — новые ключи `sb_publishable_…` / `sb_secret_…`
- `ANTHROPIC_API_KEY` — опционально для Oracle (Claude)

Без Claude Oracle отвечает по локальному контексту.

## Столпы

- **Пульт** — общий прогресс, здоровье, проекты
- **Задачи / Цели / Wish / Мысли / Пароли**
- **Карта** — граф жизни
- **Проекты** — компании + дневник
- **Капитал** — финансы
- **Oracle** — стратег
- **Настройки** — тема, экспорт/импорт, Shortcuts token

## Данные

Сейчас: локальный `data/lifeos.json`.  
Схема Postgres: `supabase/migrations/001_init.sql` (подключить после URL + ключей).
