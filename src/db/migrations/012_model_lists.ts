import type { DatabaseSync } from 'node:sqlite';
import {
  CREATE_MODEL_LISTS_TABLE_SQL,
  CREATE_MODEL_LIST_ITEMS_TABLE_SQL,
  CREATE_MODEL_LIST_INDEXES_SQL,
} from '../modelListSchema.js';

export const migration = {
  id: '012_model_lists',
  up(db: DatabaseSync): void {
    db.exec(CREATE_MODEL_LISTS_TABLE_SQL);
    db.exec(CREATE_MODEL_LIST_ITEMS_TABLE_SQL);
    db.exec(CREATE_MODEL_LIST_INDEXES_SQL);
  },
};
