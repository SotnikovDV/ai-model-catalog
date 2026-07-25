import type { DatabaseSync } from 'node:sqlite';
import { CREATE_TABLE_SQL } from '../schema.js';
import { CREATE_SETTINGS_TABLE_SQL } from '../settingsSchema.js';
import { CREATE_SYNC_LOGS_TABLE_SQL } from '../syncLogSchema.js';

export const migration = {
  id: '001_baseline',
  up(db: DatabaseSync): void {
    db.exec(CREATE_TABLE_SQL);
    db.exec(CREATE_SETTINGS_TABLE_SQL);
    db.exec(CREATE_SYNC_LOGS_TABLE_SQL);
  },
};
