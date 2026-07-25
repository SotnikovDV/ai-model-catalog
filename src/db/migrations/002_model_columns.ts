import type { DatabaseSync } from 'node:sqlite';
import { applyColumnMigrations } from '../schema.js';

export const migration = {
  id: '002_model_columns',
  up(db: DatabaseSync): void {
    applyColumnMigrations(db);
  },
};
