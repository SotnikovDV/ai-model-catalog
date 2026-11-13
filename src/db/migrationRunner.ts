import type { DatabaseSync } from 'node:sqlite';
import { CREATE_SCHEMA_MIGRATIONS_TABLE_SQL } from './schemaMigrations.js';
import { migration as migration001 } from './migrations/001_baseline.js';
import { migration as migration002 } from './migrations/002_model_columns.js';
import { migration as migration003 } from './migrations/003_indexes.js';
import { migration as migration004 } from './migrations/004_providers.js';
import { migration as migration005 } from './migrations/005_models_provider_id.js';
import { migration as migration006 } from './migrations/006_providers_base_url.js';
import { migration as migration007 } from './migrations/007_assistant_chats.js';
import { migration as migration008 } from './migrations/008_supports_web_search.js';
import { migration as migration009 } from './migrations/009_model_availability.js';
import { migration as migration010 } from './migrations/010_bothub_chat_base_url.js';
import { migration as migration011 } from './migrations/011_model_chat_ratings.js';
import { migration as migration012 } from './migrations/012_model_lists.js';

export interface Migration {
  id: string;
  up: (db: DatabaseSync) => void;
}

const MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
];

function getAppliedMigrationIds(db: DatabaseSync): Set<string> {
  const rows = db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[];
  return new Set(rows.map((row) => row.id));
}

export function runMigrations(db: DatabaseSync): string[] {
  db.exec(CREATE_SCHEMA_MIGRATIONS_TABLE_SQL);
  const applied = getAppliedMigrationIds(db);
  const newlyApplied: string[] = [];

  const insert = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;

    db.exec('BEGIN');
    try {
      migration.up(db);
      insert.run(migration.id, new Date().toISOString());
      db.exec('COMMIT');
      newlyApplied.push(migration.id);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return newlyApplied;
}

export function listMigrations(): string[] {
  return MIGRATIONS.map((m) => m.id);
}
