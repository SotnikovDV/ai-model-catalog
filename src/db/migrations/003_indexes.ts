import type { DatabaseSync } from 'node:sqlite';
import { CREATE_INDEXES_SQL } from '../schema.js';
import { CREATE_SYNC_LOGS_INDEXES_SQL } from '../syncLogSchema.js';

export const migration = {
  id: '003_indexes',
  up(db: DatabaseSync): void {
    db.exec(CREATE_INDEXES_SQL);
    db.exec(CREATE_SYNC_LOGS_INDEXES_SQL);
  },
};
