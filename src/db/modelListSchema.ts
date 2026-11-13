export const CREATE_MODEL_LISTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS model_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_MODEL_LIST_ITEMS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS model_list_items (
  list_id TEXT NOT NULL REFERENCES model_lists(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  comment TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (list_id, model_id)
);
`;

export const CREATE_MODEL_LIST_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_model_list_items_list_sort
  ON model_list_items(list_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_model_list_items_model
  ON model_list_items(model_id);
CREATE INDEX IF NOT EXISTS idx_model_lists_name
  ON model_lists(name);
`;
