import type { DatabaseSync } from 'node:sqlite';
import {
  CREATE_ASSISTANT_CHATS_INDEXES_SQL,
  CREATE_ASSISTANT_CHATS_TABLE_SQL,
} from '../assistantChatSchema.js';

export const migration = {
  id: '007_assistant_chats',
  up(db: DatabaseSync): void {
    db.exec(CREATE_ASSISTANT_CHATS_TABLE_SQL);
    db.exec(CREATE_ASSISTANT_CHATS_INDEXES_SQL);
  },
};
