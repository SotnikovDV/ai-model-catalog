export const CREATE_MODEL_CHAT_RATINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS model_chat_ratings (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  response_id TEXT NOT NULL,
  response_content TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT NOT NULL DEFAULT '',
  rated_at TEXT NOT NULL
);
`;

export const CREATE_MODEL_CHAT_RATINGS_INDEXES_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_chat_ratings_response
  ON model_chat_ratings(model_id, response_id);
CREATE INDEX IF NOT EXISTS idx_model_chat_ratings_model_rated_at
  ON model_chat_ratings(model_id, rated_at DESC);
`;
