import type { DatabaseSync } from 'node:sqlite';

function columnExists(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

const BASE_URL_BY_SLUG: Record<string, string> = {
  bothub: 'https://openai.bothub.chat/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  routerai: 'https://routerai.ru/api/v1',
};

export const migration = {
  id: '006_providers_base_url',
  up(db: DatabaseSync): void {
    if (!columnExists(db, 'providers', 'base_url')) {
      db.exec("ALTER TABLE providers ADD COLUMN base_url TEXT NOT NULL DEFAULT ''");
    }

    const update = db.prepare(`
      UPDATE providers
      SET base_url = ?
      WHERE slug = ? AND (base_url IS NULL OR TRIM(base_url) = '')
    `);

    for (const [slug, baseUrl] of Object.entries(BASE_URL_BY_SLUG)) {
      update.run(baseUrl, slug);
    }
  },
};
