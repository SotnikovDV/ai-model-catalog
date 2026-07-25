# AI Model Catalog — Структура базы данных

## Общие сведения

- **Тип БД:** SQLite (`node:sqlite`, встроенный в Node.js 22)
- **Путь к файлу:** `data/models.db` (относительно корня проекта, настраивается через `DB_PATH`)
- **Режим журналирования:** WAL (`PRAGMA journal_mode = WAL`)
- **Таблицы:** `models`, `providers`, `settings`, `sync_logs`, `schema_migrations`

---

## Таблица `models`

Хранит AI-модели с их характеристиками, ценами и возможностями.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `TEXT PRIMARY KEY` | UUID модели (генерируется автоматически) |
| `name` | `TEXT NOT NULL` | Название модели, например `GPT-4o` |
| `provider` | `TEXT NOT NULL` | Denormalized имя источника каталога (кэш `providers.name`), например `BotHub` |
| `provider_id` | `TEXT` | FK на `providers.id` |
| `family` | `TEXT NOT NULL DEFAULT ''` | Семейство / производитель модели, например `OpenAI`, `Anthropic`, `Meta` |
| `modality` | `TEXT NOT NULL DEFAULT 'text'` | Модальность: `text`, `image`, `audio`, `video`, `multimodal` |
| `context_window` | `INTEGER NOT NULL DEFAULT 0` | Размер контекстного окна в токенах |
| `max_output_tokens` | `INTEGER NOT NULL DEFAULT 0` | Максимальное количество выходных токенов |
| `input_price_per_mtok` | `REAL NOT NULL DEFAULT 0` | Цена за 1 млн входных токенов, **RUB** |
| `output_price_per_mtok` | `REAL NOT NULL DEFAULT 0` | Цена за 1 млн выходных токенов, **RUB** |
| `supports_vision` | `INTEGER NOT NULL DEFAULT 0` | Поддержка анализа изображений (`1`/`0`) |
| `supports_function_calling` | `INTEGER NOT NULL DEFAULT 0` | Поддержка function calling (`1`/`0`) |
| `supports_json_mode` | `INTEGER NOT NULL DEFAULT 0` | Поддержка JSON mode (`1`/`0`) |
| `supports_streaming` | `INTEGER NOT NULL DEFAULT 0` | Поддержка потоковой передачи (`1`/`0`) |
| `is_favorite` | `INTEGER NOT NULL DEFAULT 0` | Избранное (`1`/`0`); **не перезаписывается при sync** |
| `is_hidden` | `INTEGER NOT NULL DEFAULT 0` | Скрыта из каталога (`1`/`0`); **не перезаписывается при sync** |
| `reasoning` | `INTEGER NOT NULL DEFAULT 3` | Размышление / многошаговый вывод и планирование, шкала 1–5 |
| `task_quality` | `INTEGER NOT NULL DEFAULT 3` | Качество на целевой задаче, шкала 1–5 |
| `latency` | `INTEGER NOT NULL DEFAULT 3` | Время ответа до первого токена, шкала 1–5 (5 = мгновенно) |
| `generation_speed` | `INTEGER NOT NULL DEFAULT 3` | Скорость генерации токенов, шкала 1–5 |
| `hallucinations` | `INTEGER NOT NULL DEFAULT 3` | Склонность к галлюцинациям, шкала 1–5 (5 = редко) |
| `instruction_following` | `INTEGER NOT NULL DEFAULT 3` | Следование инструкциям, формату, schema, шкала 1–5 |
| `code_quality` | `INTEGER NOT NULL DEFAULT 3` | Качество кодогенерации, рефакторинга, code review, шкала 1–5 |
| `multilingual_quality` | `INTEGER NOT NULL DEFAULT 3` | Многоязычность и code-switching, шкала 1–5 |
| `robustness` | `INTEGER NOT NULL DEFAULT 3` | Устойчивость к шуму, опечаткам, jailbreak, prompt injection, шкала 1–5 |
| `rag_compatibility` | `INTEGER NOT NULL DEFAULT 3` | Работа в RAG-сценариях, шкала 1–5 |
| `release_date` | `TEXT` | Дата релиза в формате `YYYY-MM-DD` |
| `description` | `TEXT NOT NULL DEFAULT ''` | Описание модели |
| `use_cases` | `TEXT NOT NULL DEFAULT '[]'` | Сценарии использования, JSON-массив канонических строк из справочника `src/data/useCaseTaxonomy.json` (15 категорий) |
| `pros` | `TEXT NOT NULL DEFAULT '[]'` | Плюсы модели, JSON-массив строк |
| `cons` | `TEXT NOT NULL DEFAULT '[]'` | Минусы модели, JSON-массив строк |
| `benchmarks` | `TEXT NOT NULL DEFAULT '{}'` | Бенчмарки, JSON-объект `название → значение` |
| `tags` | `TEXT NOT NULL DEFAULT '[]'` | Теги, JSON-массив строк |
| `info_updated_at` | `TEXT` | Дата последнего обновления сведений из внешних источников (ISO-8601), `NULL` если не обновлялась |
| `availability_checked_at` | `TEXT` | Дата последней проверки доступности (ISO-8601) |
| `availability_status` | `TEXT` | `available`, `inference`, `unavailable` или `NULL` |
| `availability_response_ms` | `INTEGER` | Время отклика inference-проверки (мс), `NULL` для catalog |
| `availability_error` | `TEXT` | Сообщение последней ошибки проверки |
| `created_at` | `TEXT NOT NULL` | Дата создания записи в ISO-8601 |
| `updated_at` | `TEXT NOT NULL` | Дата обновления записи в ISO-8601 |

### Индексы `models`

- `idx_models_provider`, `idx_models_provider_id`, `idx_models_family`, `idx_models_modality`
- `idx_models_vision`, `idx_models_function_calling`, `idx_models_json_mode`, `idx_models_streaming`
- `idx_models_favorite`, `idx_models_hidden`
- `idx_models_context_window`, `idx_models_input_price`, `idx_models_output_price`
- `idx_models_release_date`, `idx_models_info_updated_at`
- `idx_models_availability_status`, `idx_models_availability_checked_at`
- Индексы по рейтингам: `reasoning`, `task_quality`, `latency`, `generation_speed`, `hallucinations`, `instruction_following`, `code_quality`, `multilingual_quality`, `robustness`, `rag_compatibility`
- Уникальность имени: `LOWER(TRIM(name))`

---

## Таблица `providers`

Справочник источников каталога для sync (URL, ключ, тип). DDL: `src/db/providerSchema.ts`. Миграция: `004_providers`.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `TEXT PRIMARY KEY` | UUID провайдера |
| `name` | `TEXT NOT NULL UNIQUE` | Отображаемое имя, например `BotHub` |
| `slug` | `TEXT NOT NULL UNIQUE` | Идентификатор, например `bothub` |
| `enabled` | `INTEGER NOT NULL DEFAULT 1` | Включён ли источник (`1`/`0`) |
| `base_url` | `TEXT NOT NULL DEFAULT ''` | OpenAI-compatible endpoint для тестового чата моделей (миграция `006`) |
| `models_url` | `TEXT NOT NULL DEFAULT ''` | URL API каталога моделей |
| `api_key` | `TEXT NOT NULL DEFAULT ''` | API-ключ: для чата — обязателен; для sync BotHub — fallback на `ai.api_key` |
| `catalog_source` | `TEXT NOT NULL DEFAULT 'custom'` | Тип: `bothub`, `openrouter`, `routerai`, `custom` |
| `created_at` | `TEXT NOT NULL` | ISO-8601 |
| `updated_at` | `TEXT NOT NULL` | ISO-8601 |

### Seed (миграция 004)

| slug | name | catalog_source |
|------|------|----------------|
| `bothub` | BotHub | bothub |
| `openrouter` | OpenRouter | openrouter |
| `routerai` | RouterAI | routerai |

### Индексы `providers`

- `idx_providers_slug`
- `idx_providers_enabled`

---

## Таблица `settings`

Key-value хранилище конфигурации (AI-провайдер, sync). DDL: `src/db/settingsSchema.ts`.

| Поле | Тип | Описание |
|------|-----|----------|
| `key` | `TEXT PRIMARY KEY` | Ключ настройки |
| `value` | `TEXT NOT NULL` | Значение (строка; булевы — `'0'`/`'1'`) |
| `updated_at` | `TEXT NOT NULL` | ISO-8601 |

### Известные ключи

| Ключ | Назначение | Default / источник |
|------|------------|-------------------|
| `ai.enabled` | Включён ли AI-провайдер | `AI_ENABLED` env |
| `ai.base_url` | URL OpenAI-compatible API | `AI_BASE_URL` |
| `ai.api_key` | API-ключ | `AI_API_KEY` |
| `ai.model_simple` | Модель для быстрых задач | `AI_MODEL_SIMPLE` |
| `ai.model_analytics` | Модель для аналитики | `AI_MODEL_ANALYTICS` |
| `sync.usd_to_rub_rate` | Курс USD→RUB для цен при sync | `105` |

Значения в `settings` **перекрывают** переменные окружения (см. `src/services/aiConfig.ts`, `syncConfig.ts`).

---

## Таблица `sync_logs`

Журнал batch- и single-синхронизаций. DDL: `src/db/syncLogSchema.ts`.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `TEXT PRIMARY KEY` | UUID записи журнала |
| `kind` | `TEXT NOT NULL` | `batch` или `single` |
| `status` | `TEXT NOT NULL` | `success` / `partial` / `error` |
| `dry_run` | `INTEGER NOT NULL DEFAULT 0` | Пробный прогон без записи (`1`/`0`) |
| `started_at` | `TEXT NOT NULL` | Начало (ISO-8601) |
| `finished_at` | `TEXT NOT NULL` | Окончание (ISO-8601) |
| `duration_ms` | `INTEGER NOT NULL` | Длительность в мс |
| `model_id` | `TEXT` | ID модели (для single sync) |
| `model_name` | `TEXT` | Имя модели (для single sync) |
| `options_json` | `TEXT NOT NULL DEFAULT '{}'` | Параметры sync (JSON) |
| `summary_json` | `TEXT NOT NULL DEFAULT '{}'` | Итоги (JSON) |
| `error_message` | `TEXT` | Текст ошибки, если есть |
| `results_json` | `TEXT NOT NULL DEFAULT '[]'` | Детали по моделям (JSON-массив) |

### Индексы `sync_logs`

- `idx_sync_logs_started_at`
- `idx_sync_logs_kind`
- `idx_sync_logs_status`

---

## Таблица `schema_migrations`

Учёт применённых версионированных миграций. DDL: `src/db/schemaMigrations.ts`.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `TEXT PRIMARY KEY` | Идентификатор миграции, например `001_baseline` |
| `applied_at` | `TEXT NOT NULL` | ISO-8601 |

Миграции: `src/db/migrations/`. Runner: `src/db/migrationRunner.ts`. При старте вызывается `ensureSchema()` (без мутации данных моделей). Обслуживание: `npm run db:maintenance`.

---

## Соглашения

- Булевы поля хранятся как `INTEGER` (`1` = true, `0` = false).
- Оценочные атрибуты (reasoning, task_quality, latency и т.д.) — `INTEGER` со шкалой 1–5, где 3 — среднее.
- JSON-поля (`use_cases`, `pros`, `cons`, `benchmarks`, `tags`) сериализуются в строку при записи и парсятся при чтении.
- Все даты — ISO-8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`) как `TEXT`.
- `id` генерируется через `crypto.randomUUID()` / `uuid` v4.
- **Цены** (`*_price_per_mtok`) хранятся в **RUB за 1 млн токенов**. При sync из источников в USD конвертация идёт через `sync.usd_to_rub_rate` (`src/services/syncConfig.ts`).
- `is_favorite` и `is_hidden` — пользовательские флаги; sync их не перезаписывает.
- При первом запуске таблицы создаются автоматически; seed — если `models` пуста (`src/db/migrate.ts`).

---

## Файлы, связанные с БД

| Файл | Назначение |
|------|------------|
| `src/db/db.ts` | Подключение к SQLite, путь, режим WAL |
| `src/db/providerSchema.ts` | DDL `providers` |
| `src/db/schema.ts` | SQL-определение `models` и индексов, column migrations |
| `src/db/settingsSchema.ts` | DDL `settings` |
| `src/db/syncLogSchema.ts` | DDL `sync_logs` и индексов |
| `src/db/migrate.ts` | `ensureSchema()`: миграции + seed |
| `src/db/maintenance.ts` | Дедуп, prune, backfill (`db:maintenance`) |
| `src/db/migrationRunner.ts` | Версионированные миграции |
| `src/db/seeds.ts` | Начальный набор моделей |
| `src/models/modelRepository.ts` | CRUD, фильтрация, сортировка, поиск |
| `src/models/providerRepository.ts` | CRUD справочника провайдеров |
| `src/models/settingsRepository.ts` | Чтение/запись settings |
| `src/models/syncLogRepository.ts` | Журнал sync |

---

## Примеры использования

### Фильтрация по семейству и модальности
```sql
SELECT * FROM models
WHERE family = 'OpenAI' AND modality = 'multimodal';
```

### Поиск по названию или описанию
```sql
SELECT * FROM models
WHERE name LIKE '%GPT%' OR description LIKE '%GPT%';
```

### Модели с vision и большим контекстом
```sql
SELECT * FROM models
WHERE supports_vision = 1 AND context_window >= 100000
ORDER BY input_price_per_mtok ASC;
```

### Модели с высоким качеством кода и RAG-совместимостью
```sql
SELECT * FROM models
WHERE code_quality >= 4 AND rag_compatibility >= 4
ORDER BY task_quality DESC, input_price_per_mtok ASC;
```

### Последние sync-операции
```sql
SELECT id, kind, status, started_at, duration_ms, model_name
FROM sync_logs
ORDER BY started_at DESC
LIMIT 20;
```
