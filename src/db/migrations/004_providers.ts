import type { DatabaseSync } from 'node:sqlite';
import { v4 as uuid } from 'uuid';
import {
  CREATE_PROVIDERS_INDEXES_SQL,
  CREATE_PROVIDERS_TABLE_SQL,
} from '../providerSchema.js';

const BOTHUB_LIST_URL = 'https://bothub.chat/api/v2/model/list';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models';
const ROUTERAI_URL = 'https://routerai.ru/api/v1/models';

const SEED_PROVIDERS = [
  {
    slug: 'bothub',
    name: 'BotHub',
    catalog_source: 'bothub',
    models_url: BOTHUB_LIST_URL,
  },
  {
    slug: 'openrouter',
    name: 'OpenRouter',
    catalog_source: 'openrouter',
    models_url: OPENROUTER_URL,
  },
  {
    slug: 'routerai',
    name: 'RouterAI',
    catalog_source: 'routerai',
    models_url: ROUTERAI_URL,
  },
] as const;

export const migration = {
  id: '004_providers',
  up(db: DatabaseSync): void {
    db.exec(CREATE_PROVIDERS_TABLE_SQL);
    db.exec(CREATE_PROVIDERS_INDEXES_SQL);

    const count = db.prepare('SELECT COUNT(*) as count FROM providers').get() as { count: number };
    if (count.count > 0) return;

    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO providers (
        id, name, slug, enabled, models_url, api_key, catalog_source, created_at, updated_at
      ) VALUES (?, ?, ?, 1, ?, '', ?, ?, ?)
    `);

    for (const provider of SEED_PROVIDERS) {
      insert.run(
        uuid(),
        provider.name,
        provider.slug,
        provider.models_url,
        provider.catalog_source,
        now,
        now,
      );
    }
  },
};
