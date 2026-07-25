# AGENTS.md — AI Model Catalog

Руководство для AI-агентов, работающих с этим репозиторием.

## Назначение проекта

Веб-каталог AI/LLM-моделей для обоснованного выбора моделей под сервисы и приложения. Основной источник данных — BotHub (`bothub.chat`), дополнительно OpenRouter, RouterAI. Поддерживаются синхронизация, AI-обогащение полей, рекомендации и тестовый чат.

## Стек и ограничения

| Компонент | Технология |
|-----------|------------|
| Runtime | **Node.js 22+** (обязателен `node:sqlite`) |
| Язык | TypeScript 5, ESM (`"type": "module"`) |
| Backend | Express 4, Zod, uuid, dotenv |
| БД | SQLite через `node:sqlite` (`DatabaseSync`) — **не** better-sqlite3, **не** Prisma |
| UI | EJS (SSR) + vanilla JS + `src/public/styles.css` |
| Сборка | `tsc` → `dist/`, dev: `tsx watch` |
| Deploy | Docker + `docker-compose.yml` (Synology NAS, см. `.docs/deploy-synology.md`) |

## Структура каталогов

```
src/
  server.ts, app.ts     — точка входа, Express
  types.ts, types/      — Zod-схемы (Model, AI, Sync)
  db/                   — схема, migrate, seed, утилиты
  models/               — репозитории (model, settings, syncLog)
  routes/               — api, aiApi, pages, syncApi, singleModelSync
  services/             — sync, AI, catalog sources, recommendations
  utils/, data/         — helpers, fieldMeta
  views/, public/       — EJS + клиентский JS/CSS
docs/                   — справочные JSON-каталоги, database-schema.md
.docs/                  — проектная документация (требования, планы, задачи)
data/                   — SQLite (models.db, в .gitignore)
```

## Команды

```bash
npm run dev          # разработка
npm run build        # сборка
npm start            # production
npm run db:init      # миграция + seed (если БД пуста)
npm run typecheck    # проверка типов
npm run db:prune     # prune по docs/bothub_models.json
npm run clean-db     # очистка БД
```

`migrate()` вызывается **при каждом старте** в `src/app.ts` как `ensureSchema()` — только схема и seed. Дедуп/prune/backfill — `npm run db:maintenance`.

## Ключевые соглашения

1. **Импорты ESM** — всегда с суффиксом `.js` в TypeScript-импортах (`import x from './foo.js'`).
2. **Валидация API** — через Zod (`ModelSchema`, схемы в `src/types/`). Ошибки — `{ error, issues }` с кодом 400.
3. **Булевы в SQLite** — `INTEGER` 0/1; JSON-поля — строки, парсятся в репозитории.
4. **Цены** — в БД хранятся в **RUB за 1M токенов** (конвертация из USD при sync через `sync.usd_to_rub_rate`).
5. **Настройки** — key-value в таблице `settings`; AI-конфиг перекрывает `.env`.
6. **Sync не трогает** `is_favorite`, `is_hidden` — пользовательские флаги.
7. **UI** — без bundler; новый JS — в `src/public/`, стили — `styles.css`. Tailwind CDN в `partials/head.ejs` не используется.
8. **Язык UI и сообщений** — русский.

## Источники истины

| Что | Где |
|-----|-----|
| Схема модели | `src/types.ts`, `src/db/schema.ts` |
| Sync-поля | `src/types/sync.ts`, `src/data/fieldMeta.ts` |
| AI-конфиг | `src/services/aiConfig.ts`, `src/types/ai.ts` |
| API-маршруты | `src/routes/*.ts` |
| БД (полная) | `docs/database-schema.md` |

## Чего нет (не предлагать без запроса)

- Multi-user / роли сверх одного админа
- Prisma, ORM, React/Vue, bundler
- PM2 конфигурация

## Безопасность

- Админка, CRUD моделей, чат, AI-ассистент, sync/evaluate защищены **сессией** (`/login`) при заданном `ADMIN_PASSWORD`; API также принимает HTTP Basic Auth (см. `.env.example`)
- Каталог на чтение (`/`, карточки) остаётся публичным
- Rate limiting на `/api/ai/*` и `/api/models/sync/*`
- `GET /health` — без auth, для мониторинга
- Для production: задайте `ADMIN_PASSWORD`, используйте HTTPS (reverse proxy)
- Не коммитьте `.env`, `data/`, `backups/` (см. `.gitignore`, `SECURITY.md`)

## Документация

- [README.md](README.md) — установка и обзор
- [docs/database-schema.md](docs/database-schema.md) — схема БД
- [SECURITY.md](SECURITY.md) — политика безопасности

## Правила Cursor

См. `.cursor/rules/*.mdc` — применяются автоматически при работе с соответствующими файлами (локально).
