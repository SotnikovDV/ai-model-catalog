# AI Model Catalog

Веб-каталог AI/LLM-моделей для обоснованного выбора моделей под сервисы и приложения. Основной источник данных — BotHub (`bothub.chat`), дополнительно OpenRouter и RouterAI.

## Требования

- **Node.js 22+** (обязателен встроенный модуль `node:sqlite`)

## Технологии

| Компонент | Стек |
|-----------|------|
| Runtime | Node.js 22+, TypeScript 5, ESM |
| Backend | Express 4, Zod, dotenv, uuid |
| БД | SQLite через `node:sqlite` (`DatabaseSync`) |
| UI | EJS (SSR) + vanilla JS + `styles.css` |
| Dev | `tsx watch`, `tsc` → `dist/` |

## Установка и запуск

```bash
cp .env.example .env   # при необходимости настройте PORT, DB_PATH, AI_*
npm install
npm run db:init        # миграция + seed (если БД пуста)
npm run dev
```

Приложение: http://localhost:3000

`migrate()` / `ensureSchema()` вызывается при каждом старте — только схема и seed. Обслуживание данных: `npm run db:maintenance`.

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Разработка с hot reload |
| `npm run build` | Сборка TypeScript → `dist/` |
| `npm start` | Production (`node dist/server.js`) |
| `npm run db:init` | Миграция схемы + seed при пустой БД |
| `npm run db:maintenance` | Обслуживание БД: дедуп, prune, backfill (вручную) |
| `npm run db:backup` | Снимок SQLite в `BACKUP_DIR` (online `node:sqlite` backup) |
| `npm run db:prune` | Prune по `docs/bothub_models.json` |
| `npm run clean-db` | Очистка БД |
| `npm run typecheck` | Проверка типов без сборки |
| `npm run lint` | ESLint (TypeScript) |
| `npm run test` | Vitest (unit + API smoke) |

## Основные возможности

- Каталог с фильтрацией, сортировкой, поиском, избранным и скрытием моделей
- Карточка модели, CRUD, сравнение, импорт/экспорт JSON
- Синхронизация из BotHub / OpenRouter / RouterAI (batch, SSE, single-model)
- AI-обогащение полей (рейтинги, use cases, pros/cons) через OpenAI-compatible API
- AI-ассистент подбора моделей (`/assistant`) и страница рекомендаций
- Тестовый чат с моделью (`/models/:id/chat`) и чат-сравнение нескольких моделей (`/compare/chat`)
- Админка: AI-конфиг, sync UI, журнал синхронизаций

## Структура проекта

```
src/
  server.ts, app.ts   — точка входа, Express
  types.ts, types/    — Zod-схемы
  db/                 — схема, migrate, seed
  models/             — репозитории
  routes/             — API и SSR-страницы
  services/           — sync, AI, catalog sources
  views/, public/     — EJS + клиентский JS/CSS
docs/                 — схема БД, JSON-снимки каталогов
data/                 — SQLite (models.db, в .gitignore)
```

## Конфигурация

См. `.env.example`:

- `PORT`, `DB_PATH`
- `AI_ENABLED`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_SIMPLE`, `AI_MODEL_ANALYTICS`
- `AI_SEARCH_BASE_URL` (по умолчанию `https://api.perplexity.ai`), `AI_SEARCH_API_KEY`, `AI_MODEL_SEARCH` — модель с поиском (пустой ключ → `AI_API_KEY`)
- `BOTHUB_EMAIL`, `BOTHUB_PASSWORD` — или `BOTHUB_ACCESS_TOKEN` (JWT) для баланса Caps в шапке (только админ)

AI-настройки из админки (`/admin`) сохраняются в таблице `settings` и перекрывают `.env`.

Цены в БД хранятся в **RUB за 1M токенов** (конвертация USD→RUB при sync).

## Документация

| Файл | Содержание |
|------|------------|
| [AGENTS.md](AGENTS.md) | Руководство для AI-агентов |
| [docs/database-schema.md](docs/database-schema.md) | Схема БД |
| [SECURITY.md](SECURITY.md) | Политика безопасности и чеклист деплоя |

## Безопасность

Подробнее: [SECURITY.md](SECURITY.md). Лицензия: [MIT](LICENSE).

### Авторизация администратора (опционально)

Задайте `ADMIN_PASSWORD` в `.env` — тогда:

**Публично (без входа):** каталог на чтение (`/`, карточки, compare), `GET /health`, login/status, masked `GET` конфигов.

**Только админ** (сессия `/login` или HTTP Basic):

- страницы `/admin*`, `/models/new`, `/models/:id/edit`, `/models/:id/chat`, `/compare/chat`, `/assistant`
- CRUD моделей API (`POST/PUT/DELETE /api/models…`), import/wipe
- чат модели, автооценка, single/batch sync и availability
- AI: `POST /api/ai/chat|recommend|test`, CRUD `/api/ai/chats`, `PUT /api/ai/config`
- CRUD `/api/providers`, `PUT` sync config, `POST` рейтингов чата
- `GET /api/bothub/balance` — баланс BotHub (Caps)

По умолчанию (`ADMIN_PASSWORD` пуст) auth **отключён** — только для локальной разработки. В сети/интернете всегда задавайте пароль.

```env
ADMIN_USER=admin
ADMIN_PASSWORD=your-secret
SESSION_SECRET=long-random-string
```

Вход через `/login` (httpOnly cookie). Для API и скриптов — HTTP Basic Auth.

### Production checklist

1. Задайте `ADMIN_PASSWORD` и `SESSION_SECRET`.
2. Храните секреты в `.env` (файл в `.gitignore`).
3. При утечке ключей — ротируйте API-ключи провайдеров.

### Rate limiting

- `/api/ai/*` — 60 запросов / 15 мин (`AI_RATE_LIMIT_MAX`)
- `/api/models/sync/*` — 10 запросов / 15 мин (`SYNC_RATE_LIMIT_MAX`)

### Health check

`GET /health` — статус приложения и БД (без auth, для мониторинга).

### Бэкап

**Локальная разработка (код + БД в zip):**

```cmd
backup.cmd
```

Создаёт zip с кодом проекта и SQLite (`DB_PATH`, включая `-wal`/`-shm`). Папка вывода: `backups/`.

**Production / ежедневный снимок SQLite** (только БД, без `.env`):

- Планировщик в процессе приложения при `BACKUP_ENABLED=true` (в Docker по умолчанию включён).
- Файлы: `models-daily-YYYY-MM-DD.db` (хранить 7) и по воскресеньям `models-weekly-YYYY-MM-DD.db` (хранить 4).
- Механизм: online `backup()` из `node:sqlite` + `PRAGMA integrity_check` на копии.
- Не копируйте `data/models.db` с хоста при **работающем** контейнере — это ломает WAL.

Ручной снимок:

```bash
# Windows (локально):
db-backup.cmd
# или: npm run db:backup

# Synology NAS (из папки проекта):
chmod +x db-backup.sh   # один раз
./db-backup.sh
# то же самое: docker compose run --rm app node dist/db/backup.js
```

Восстановление из бэкапа:

```bash
docker compose stop
cp data/models.db data/models.db.before-restore
cp backups/models-daily-YYYY-MM-DD.db data/models.db
rm -f data/models.db-wal data/models.db-shm
docker compose up -d
```

Дополнительно на Synology имеет смысл держать снимок тома / Hyper Backup папки `data/` и `backups/` — это внешний слой, не заменяет online-бэкап приложения.

## Docker / Synology NAS

Для production-деплоя на Synology NAS (Container Manager):

```bash
cp .env.docker.example .env   # задайте ADMIN_PASSWORD и SESSION_SECRET
mkdir -p data backups
docker compose up -d --build
```

Приложение: http://localhost:3000 (порт настраивается в `docker-compose.yml`).

SQLite: volume `./data` (`DB_PATH=/app/data/models.db`). Бэкапы: volume `./backups` (`BACKUP_DIR=/app/backups`). Часовой пояс контейнера: `TZ=Europe/Moscow` (час бэкапа `BACKUP_HOUR=3` — московский).

**Обслуживание БД на NAS (Docker):** `npm run db:maintenance` на хосте не подходит — в production-образе нет `tsx`. Остановите контейнер, выполните maintenance, перезапустите:

```bash
docker compose stop
docker compose run --rm app node dist/db/maintenance.js
docker compose up -d
```

После правки `data/models.db` с хоста (SQL, sqlite3) тоже нужен **restart** контейнера: приложение держит открытое соединение с SQLite и не видит внешние изменения, пока процесс не перезапущен. Надёжнее править БД при **остановленном** контейнере. Правка при работающем процессе (особенно при WAL: `models.db-wal` / `models.db-shm`) может повредить файл (`database disk image is malformed`) — тогда падает журнал обновлений.

Проверка целостности (контейнер остановлен):

```bash
docker compose stop
docker compose run --rm app node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync('/app/data/models.db'); console.log(db.prepare('PRAGMA integrity_check').all());"
```

Если повреждены страницы B-tree (`free space corruption`, `Rowid out of order`, `2nd reference to page`) — **не делайте DROP TABLE** на этом файле. Скопируйте читаемые данные в новый файл:

```bash
# скрипт должен лежать в смонтированном volume, например data/
docker compose stop
cp data/models.db data/models.db.corrupt
node scripts/recover-sqlite.mjs   # локально
# на NAS, если скрипт скопирован в data/:
docker compose run --rm app node /app/data/recover-sqlite.mjs
# затем: mv data/models.recovered.db data/models.db
# удалите data/models.db-wal и data/models.db-shm, если есть
```

Если `integrity_check` сообщает об ошибках только в `sync_logs`, журнал можно пересоздать (история синхронизаций пропадёт, каталог моделей сохранится):

```bash
docker compose run --rm app node dist/db/maintenance.js
docker compose up -d
```

Проверить, что контейнер монтирует нужный файл:

```bash
docker inspect ai-model-catalog --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
```

**Деплой с Windows на NAS** (код + существующая БД):

```cmd
deploy-nas.cmd
```
