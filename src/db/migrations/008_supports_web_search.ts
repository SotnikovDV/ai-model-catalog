import type { DatabaseSync } from 'node:sqlite';
import { applyColumnMigrations } from '../schema.js';

export const migration = {
  id: '008_supports_web_search',
  up(db: DatabaseSync): void {
    applyColumnMigrations(db);

    db.exec('CREATE INDEX IF NOT EXISTS idx_models_web_search ON models(supports_web_search)');

    db.exec(`
      UPDATE models
      SET supports_web_search = 1
      WHERE supports_web_search = 0
        AND (
          LOWER(tags) LIKE '%"native_web_search"%'
          OR LOWER(tags) LIKE '%"web_search_options"%'
        )
    `);
  },
};
