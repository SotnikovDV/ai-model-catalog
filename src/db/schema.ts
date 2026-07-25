export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  family TEXT NOT NULL DEFAULT '',
  modality TEXT NOT NULL DEFAULT 'text',
  context_window INTEGER NOT NULL DEFAULT 0,
  max_output_tokens INTEGER NOT NULL DEFAULT 0,
  input_price_per_mtok REAL NOT NULL DEFAULT 0,
  output_price_per_mtok REAL NOT NULL DEFAULT 0,
  supports_vision INTEGER NOT NULL DEFAULT 0,
  supports_function_calling INTEGER NOT NULL DEFAULT 0,
  supports_json_mode INTEGER NOT NULL DEFAULT 0,
  supports_streaming INTEGER NOT NULL DEFAULT 0,
  supports_web_search INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  reasoning INTEGER NOT NULL DEFAULT 3,
  task_quality INTEGER NOT NULL DEFAULT 3,
  latency INTEGER NOT NULL DEFAULT 3,
  generation_speed INTEGER NOT NULL DEFAULT 3,
  hallucinations INTEGER NOT NULL DEFAULT 3,
  instruction_following INTEGER NOT NULL DEFAULT 3,
  code_quality INTEGER NOT NULL DEFAULT 3,
  multilingual_quality INTEGER NOT NULL DEFAULT 3,
  robustness INTEGER NOT NULL DEFAULT 3,
  rag_compatibility INTEGER NOT NULL DEFAULT 3,
  release_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  use_cases TEXT NOT NULL DEFAULT '[]',
  pros TEXT NOT NULL DEFAULT '[]',
  cons TEXT NOT NULL DEFAULT '[]',
  benchmarks TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  info_updated_at TEXT,
  availability_checked_at TEXT,
  availability_status TEXT,
  availability_response_ms INTEGER,
  availability_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_family ON models(family);
CREATE INDEX IF NOT EXISTS idx_models_modality ON models(modality);
CREATE INDEX IF NOT EXISTS idx_models_vision ON models(supports_vision);
CREATE INDEX IF NOT EXISTS idx_models_function_calling ON models(supports_function_calling);
CREATE INDEX IF NOT EXISTS idx_models_json_mode ON models(supports_json_mode);
CREATE INDEX IF NOT EXISTS idx_models_streaming ON models(supports_streaming);
CREATE INDEX IF NOT EXISTS idx_models_web_search ON models(supports_web_search);
CREATE INDEX IF NOT EXISTS idx_models_favorite ON models(is_favorite);
CREATE INDEX IF NOT EXISTS idx_models_hidden ON models(is_hidden);
CREATE INDEX IF NOT EXISTS idx_models_context_window ON models(context_window);
CREATE INDEX IF NOT EXISTS idx_models_input_price ON models(input_price_per_mtok);
CREATE INDEX IF NOT EXISTS idx_models_output_price ON models(output_price_per_mtok);
CREATE INDEX IF NOT EXISTS idx_models_release_date ON models(release_date);
CREATE INDEX IF NOT EXISTS idx_models_reasoning ON models(reasoning);
CREATE INDEX IF NOT EXISTS idx_models_task_quality ON models(task_quality);
CREATE INDEX IF NOT EXISTS idx_models_latency ON models(latency);
CREATE INDEX IF NOT EXISTS idx_models_generation_speed ON models(generation_speed);
CREATE INDEX IF NOT EXISTS idx_models_hallucinations ON models(hallucinations);
CREATE INDEX IF NOT EXISTS idx_models_instruction_following ON models(instruction_following);
CREATE INDEX IF NOT EXISTS idx_models_code_quality ON models(code_quality);
CREATE INDEX IF NOT EXISTS idx_models_multilingual_quality ON models(multilingual_quality);
CREATE INDEX IF NOT EXISTS idx_models_robustness ON models(robustness);
CREATE INDEX IF NOT EXISTS idx_models_rag_compatibility ON models(rag_compatibility);
CREATE INDEX IF NOT EXISTS idx_models_info_updated_at ON models(info_updated_at);
CREATE INDEX IF NOT EXISTS idx_models_availability_status ON models(availability_status);
CREATE INDEX IF NOT EXISTS idx_models_availability_checked_at ON models(availability_checked_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_name_norm ON models(LOWER(TRIM(name)));
`;

const COLUMN_MIGRATIONS: Array<{ name: string; definition: string }> = [
  { name: 'reasoning', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'task_quality', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'latency', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'generation_speed', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'hallucinations', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'instruction_following', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'code_quality', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'multilingual_quality', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'robustness', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'rag_compatibility', definition: 'INTEGER NOT NULL DEFAULT 3' },
  { name: 'is_favorite', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'is_hidden', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'family', definition: "TEXT NOT NULL DEFAULT ''" },
  { name: 'info_updated_at', definition: 'TEXT' },
  { name: 'supports_web_search', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'availability_checked_at', definition: 'TEXT' },
  { name: 'availability_status', definition: 'TEXT' },
  { name: 'availability_response_ms', definition: 'INTEGER' },
  { name: 'availability_error', definition: 'TEXT' },
];

export function applyColumnMigrations(db: { prepare: (sql: string) => { all: () => unknown[] }; exec: (sql: string) => void }) {
  const rows = db.prepare('PRAGMA table_info(models)').all() as { name: string }[];
  const existing = new Set(rows.map((row) => row.name));

  for (const { name, definition } of COLUMN_MIGRATIONS) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE models ADD COLUMN ${name} ${definition}`);
    }
  }
}
