export const CREATE_SYNC_LOGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  dry_run INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  model_id TEXT,
  model_name TEXT,
  options_json TEXT NOT NULL DEFAULT '{}',
  summary_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  results_json TEXT NOT NULL DEFAULT '[]'
);
`;

export const CREATE_SYNC_LOGS_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_kind ON sync_logs(kind);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
`;
