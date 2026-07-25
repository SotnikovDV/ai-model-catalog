export const CREATE_ASSISTANT_CHATS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS assistant_chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  messages_json TEXT NOT NULL DEFAULT '[]',
  last_result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_ASSISTANT_CHATS_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_assistant_chats_updated_at ON assistant_chats(updated_at DESC);
`;
