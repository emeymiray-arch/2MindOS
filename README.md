# 2MindOS

Personal Life Operating System — второй мозг, не ежедневник.

## Запуск

```bash
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Опционально AI Oracle (Claude):

```bash
echo 'ANTHROPIC_API_KEY=sk-...' > .env.local
```

Без ключа Oracle отвечает по локальному контексту графа и vitals.

## Столпы

- **Command** — MIT, цели D/W/M, vitals, намаз, привычки
- **Mind** — захват мыслей → объекты + автосвязи
- **Graph** — карта жизни (лёгкая симуляция, замирает после успокоения)
- **Operate** — проекты как компании
- **Capital** — здоровье, финансы, навыки, чтение
- **Horizon** — дерево желаний
- **Oracle** — стратег системы
- **System** — Apple Shortcuts token и reset

## Данные

Локальный store: `data/lifeos.json` (создаётся при первом запросе).  
Схема под Supabase: `supabase/migrations/001_init.sql`.

## Shortcuts

`POST /api/shortcuts` + header `x-shortcuts-token` (см. System).
