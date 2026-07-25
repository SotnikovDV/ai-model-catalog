import type { DatabaseSync } from 'node:sqlite';
import {
  CREATE_MODEL_CHAT_RATINGS_INDEXES_SQL,
  CREATE_MODEL_CHAT_RATINGS_TABLE_SQL,
} from '../modelRatingSchema.js';

export const migration = {
  id: '011_model_chat_ratings',
  up(db: DatabaseSync): void {
    db.exec(CREATE_MODEL_CHAT_RATINGS_TABLE_SQL);
    db.exec(CREATE_MODEL_CHAT_RATINGS_INDEXES_SQL);
  },
};
