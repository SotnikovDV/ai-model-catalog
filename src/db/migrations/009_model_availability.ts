import type { DatabaseSync } from 'node:sqlite';
import { applyColumnMigrations } from '../schema.js';

export const migration = {
  id: '009_model_availability',
  up(db: DatabaseSync): void {
    applyColumnMigrations(db);

    db.exec('CREATE INDEX IF NOT EXISTS idx_models_availability_status ON models(availability_status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_models_availability_checked_at ON models(availability_checked_at)');
  },
};
