import type { DatabaseSync } from 'node:sqlite';

const BOTHUB_CHAT_BASE_URL = 'https://openai.bothub.chat/v1';

export const migration = {
  id: '010_bothub_chat_base_url',
  up(db: DatabaseSync): void {
    db.prepare(`
      UPDATE providers
      SET base_url = ?
      WHERE slug = 'bothub'
        AND (
          base_url LIKE '%bothub.ru%'
          OR base_url = 'https://bothub.chat/api/v2/openai/v1'
          OR TRIM(COALESCE(base_url, '')) = ''
        )
    `).run(BOTHUB_CHAT_BASE_URL);
  },
};
