import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db.js';
import { runMigrations } from './migrationRunner.js';
import { seedModels } from './seeds.js';
import { providerRepository } from '../models/providerRepository.js';
import { v4 as uuid } from 'uuid';
import type { ModelInput } from '../types.js';

function normalizeJson(value: unknown): string {
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify([value]);
    }
  }
  return JSON.stringify(value ?? []);
}

export function insertModel(db: ReturnType<typeof getDb>, input: ModelInput) {
  const now = new Date().toISOString();
  const id = input.id ?? uuid();
  const bothub = providerRepository.getBotHub();
  let provider = input.provider;
  let providerId: string | null = input.provider_id ?? null;

  if (input.provider_id) {
    const resolved = providerRepository.findById(input.provider_id);
    if (resolved) {
      provider = resolved.name;
      providerId = resolved.id;
    }
  } else {
    const resolved = providerRepository.findByNameOrSlug(input.provider);
    if (resolved) {
      provider = resolved.name;
      providerId = resolved.id;
    } else if (bothub) {
      provider = bothub.name;
      providerId = bothub.id;
    }
  }

  const stmt = db.prepare(`
    INSERT INTO models (
      id, name, provider, provider_id, family, modality, context_window, max_output_tokens,
      input_price_per_mtok, output_price_per_mtok, supports_vision,
      supports_function_calling, supports_json_mode, supports_streaming, supports_web_search, is_favorite, is_hidden,
      reasoning, task_quality, latency, generation_speed, hallucinations,
      instruction_following, code_quality, multilingual_quality, robustness,
      rag_compatibility, release_date, description, use_cases, pros, cons, benchmarks, tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    input.name,
    provider,
    providerId,
    input.family,
    input.modality,
    input.context_window,
    input.max_output_tokens,
    input.input_price_per_mtok,
    input.output_price_per_mtok,
    input.supports_vision ? 1 : 0,
    input.supports_function_calling ? 1 : 0,
    input.supports_json_mode ? 1 : 0,
    input.supports_streaming ? 1 : 0,
    input.supports_web_search ? 1 : 0,
    input.is_favorite ? 1 : 0,
    input.is_hidden ? 1 : 0,
    input.reasoning ?? 3,
    input.task_quality ?? 3,
    input.latency ?? 3,
    input.generation_speed ?? 3,
    input.hallucinations ?? 3,
    input.instruction_following ?? 3,
    input.code_quality ?? 3,
    input.multilingual_quality ?? 3,
    input.robustness ?? 3,
    input.rag_compatibility ?? 3,
    input.release_date ?? null,
    input.description ?? '',
    normalizeJson(input.use_cases),
    normalizeJson(input.pros),
    normalizeJson(input.cons),
    normalizeJson(input.benchmarks),
    normalizeJson(input.tags),
    now,
    now
  );
}

function seedIfEmpty(db: ReturnType<typeof getDb>): void {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM models').get() as { count: number };
  if (countRow.count === 0) {
    for (const model of seedModels) {
      insertModel(db, model);
    }
    console.log(`Seeded ${seedModels.length} models.`);
  }
}

/** Schema migrations + seed при пустой БД. Без мутации существующих данных. */
export function ensureSchema(): void {
  const db = getDb();
  const applied = runMigrations(db);
  if (applied.length > 0) {
    console.log(`Applied migrations: ${applied.join(', ')}`);
  }
  seedIfEmpty(db);
}

/** @deprecated Используйте ensureSchema() при старте или db:maintenance для обслуживания */
export function migrate(): void {
  ensureSchema();
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  ensureSchema();
  console.log('Database schema ensured.');
}
