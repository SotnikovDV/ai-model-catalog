import type { DatabaseSync } from 'node:sqlite';

function columnExists(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

export const migration = {
  id: '005_models_provider_id',
  up(db: DatabaseSync): void {
    if (!columnExists(db, 'models', 'provider_id')) {
      db.exec('ALTER TABLE models ADD COLUMN provider_id TEXT REFERENCES providers(id)');
    }

    db.exec(`
      UPDATE models
      SET provider_id = (SELECT id FROM providers WHERE slug = 'bothub' LIMIT 1)
      WHERE provider_id IS NULL
        AND EXISTS (SELECT 1 FROM providers WHERE slug = 'bothub')
    `);

    db.exec('CREATE INDEX IF NOT EXISTS idx_models_provider_id ON models(provider_id)');
  },
};
