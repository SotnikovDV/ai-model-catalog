import { getDb } from '../db/db.js';
import type { Model, ModelInput, ModelFilter } from '../types.js';
import { normalizeModelName } from '../utils/normalizeModelName.js';
import { normalizeUseCases } from '../utils/useCaseTaxonomy.js';
import { providerRepository } from './providerRepository.js';

const SELECT_ALL = `
  SELECT id, name, provider, provider_id, family, modality, context_window, max_output_tokens,
         input_price_per_mtok, output_price_per_mtok, supports_vision,
         supports_function_calling, supports_json_mode, supports_streaming, supports_web_search, is_favorite, is_hidden,
         reasoning, task_quality, latency, generation_speed, hallucinations,
         instruction_following, code_quality, multilingual_quality, robustness,
         rag_compatibility, release_date, description, use_cases, pros, cons,
         benchmarks, tags, info_updated_at,
         availability_checked_at, availability_status, availability_response_ms, availability_error,
         created_at, updated_at
  FROM models
`;

function parseJson<T>(value: string | T): T {
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

function rowToModel(row: Record<string, unknown>): Model {
  return {
    id: row.id as string,
    name: row.name as string,
    provider: row.provider as string,
    provider_id: (row.provider_id as string | null) ?? undefined,
    family: row.family as string,
    modality: row.modality as Model['modality'],
    context_window: row.context_window as number,
    max_output_tokens: row.max_output_tokens as number,
    input_price_per_mtok: row.input_price_per_mtok as number,
    output_price_per_mtok: row.output_price_per_mtok as number,
    supports_vision: Boolean(row.supports_vision),
    supports_function_calling: Boolean(row.supports_function_calling),
    supports_json_mode: Boolean(row.supports_json_mode),
    supports_streaming: Boolean(row.supports_streaming),
    supports_web_search: Boolean(row.supports_web_search),
    is_favorite: Boolean(row.is_favorite),
    is_hidden: Boolean(row.is_hidden),
    reasoning: (row.reasoning as number) ?? 3,
    task_quality: (row.task_quality as number) ?? 3,
    latency: (row.latency as number) ?? 3,
    generation_speed: (row.generation_speed as number) ?? 3,
    hallucinations: (row.hallucinations as number) ?? 3,
    instruction_following: (row.instruction_following as number) ?? 3,
    code_quality: (row.code_quality as number) ?? 3,
    multilingual_quality: (row.multilingual_quality as number) ?? 3,
    robustness: (row.robustness as number) ?? 3,
    rag_compatibility: (row.rag_compatibility as number) ?? 3,
    release_date: (row.release_date as string | null) ?? undefined,
    description: row.description as string,
    use_cases: parseJson<string[]>(row.use_cases as string),
    pros: parseJson<string[]>(row.pros as string),
    cons: parseJson<string[]>(row.cons as string),
    benchmarks: parseJson<Record<string, number>>(row.benchmarks as string),
    tags: parseJson<string[]>(row.tags as string),
    info_updated_at: (row.info_updated_at as string | null) ?? null,
    availability_checked_at: (row.availability_checked_at as string | null) ?? null,
    availability_status: (row.availability_status as Model['availability_status']) ?? null,
    availability_response_ms: row.availability_response_ms != null
      ? (row.availability_response_ms as number)
      : null,
    availability_error: (row.availability_error as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function normalizeUseCasesField(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeUseCases(value);
  if (typeof value === 'string') return normalizeUseCases(value);
  return [];
}

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

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function resolveProviderFields(input: Partial<ModelInput>): { provider: string; provider_id: string | null } {
  if (input.provider_id) {
    const byId = providerRepository.findById(input.provider_id);
    if (byId) return { provider: byId.name, provider_id: byId.id };
  }

  const value = input.provider ?? 'BotHub';
  const resolved = providerRepository.findByNameOrSlug(value);
  if (resolved) return { provider: resolved.name, provider_id: resolved.id };

  const fallback = providerRepository.getBotHub();
  if (fallback) return { provider: fallback.name, provider_id: fallback.id };

  return { provider: value, provider_id: null };
}

export class ModelRepository {
  private db = getDb();

  findAll(filter: ModelFilter = {}): Model[] {
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (filter.provider) {
      conditions.push(`(
        provider = ?
        OR provider_id IN (
          SELECT id FROM providers WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)
        )
      )`);
      params.push(filter.provider, filter.provider, filter.provider);
    }
    if (filter.family) {
      conditions.push('family = ?');
      params.push(filter.family);
    }
    if (filter.modality) {
      conditions.push('modality = ?');
      params.push(filter.modality);
    }
    if (filter.supports_vision === true) {
      conditions.push('supports_vision = 1');
    }
    if (filter.supports_function_calling === true) {
      conditions.push('supports_function_calling = 1');
    }
    if (filter.supports_json_mode === true) {
      conditions.push('supports_json_mode = 1');
    }
    if (filter.supports_streaming === true) {
      conditions.push('supports_streaming = 1');
    }
    if (filter.supports_web_search === true) {
      conditions.push('supports_web_search = 1');
    }
    if (filter.is_favorite === true) {
      conditions.push('is_favorite = 1');
    }
    if (filter.exclude_hidden === true) {
      conditions.push('is_hidden = 0');
    }
    if (filter.availability_status === 'unchecked') {
      conditions.push('availability_status IS NULL');
    } else if (filter.availability_status) {
      conditions.push('availability_status = ?');
      params.push(filter.availability_status);
    }
    if (filter.min_context !== undefined) {
      conditions.push('context_window >= ?');
      params.push(filter.min_context);
    }
    if (filter.max_context !== undefined) {
      conditions.push('context_window <= ?');
      params.push(filter.max_context);
    }
    if (filter.search) {
      conditions.push('(name LIKE ? OR provider LIKE ? OR family LIKE ? OR id LIKE ?)');
      const like = `%${filter.search}%`;
      params.push(like, like, like, like);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sort = filter.sort ?? 'name';
    const order = filter.order ?? 'asc';
    const validSort = [
      'name', 'provider', 'family', 'context_window', 'input_price_per_mtok', 'output_price_per_mtok', 'release_date',
      'reasoning', 'task_quality', 'latency', 'generation_speed', 'hallucinations',
      'instruction_following', 'code_quality', 'multilingual_quality', 'robustness', 'rag_compatibility',
      'availability_checked_at',
    ].includes(sort);
    const orderBy = `ORDER BY ${validSort ? sort : 'name'} ${order === 'desc' ? 'DESC' : 'ASC'}`;

    const stmt = this.db.prepare(`${SELECT_ALL} ${where} ${orderBy}`);
    const rows = (params.length ? stmt.all(...params) : stmt.all()) as Record<string, unknown>[];
    return rows.map(rowToModel);
  }

  findById(id: string): Model | null {
    const stmt = this.db.prepare(`${SELECT_ALL} WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? rowToModel(row) : null;
  }

  findByNormalizedName(name: string): Model | null {
    const stmt = this.db.prepare(`${SELECT_ALL} WHERE LOWER(TRIM(name)) = ?`);
    const row = stmt.get(normalizeModelName(name)) as Record<string, unknown> | undefined;
    return row ? rowToModel(row) : null;
  }

  getExistingNormalizedNames(): Set<string> {
    const rows = this.db.prepare('SELECT name FROM models').all() as { name: string }[];
    return new Set(rows.map((row) => normalizeModelName(row.name)));
  }

  create(input: ModelInput): Model {
    const existing = this.findByNormalizedName(input.name);
    if (existing) {
      return this.update(existing.id, input)!;
    }
    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const { provider, provider_id } = resolveProviderFields(input);
    const stmt = this.db.prepare(`
      INSERT INTO models (
        id, name, provider, provider_id, family, modality, context_window, max_output_tokens,
        input_price_per_mtok, output_price_per_mtok, supports_vision,
        supports_function_calling, supports_json_mode, supports_streaming, supports_web_search, is_favorite, is_hidden,
        reasoning, task_quality, latency, generation_speed, hallucinations,
        instruction_following, code_quality, multilingual_quality, robustness,
        rag_compatibility, release_date, description, use_cases, pros, cons, benchmarks, tags,
        info_updated_at, availability_checked_at, availability_status, availability_response_ms, availability_error,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    try {
      stmt.run(
        id,
        input.name,
        provider,
        provider_id,
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
        normalizeJson(normalizeUseCasesField(input.use_cases)),
        normalizeJson(input.pros),
        normalizeJson(input.cons),
        normalizeJson(input.benchmarks),
        normalizeJson(input.tags),
        input.info_updated_at ?? null,
        input.availability_checked_at ?? null,
        input.availability_status ?? null,
        input.availability_response_ms ?? null,
        input.availability_error ?? null,
        now,
        now
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const duplicate = this.findByNormalizedName(input.name);
        if (duplicate) return this.update(duplicate.id, input)!;
      }
      throw error;
    }
    return this.findById(id)!;
  }

  update(id: string, input: Partial<ModelInput>): Model | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const merged = { ...existing, ...input };
    const { provider, provider_id } = resolveProviderFields(merged);
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE models SET
        name = ?, provider = ?, provider_id = ?, family = ?, modality = ?, context_window = ?, max_output_tokens = ?,
        input_price_per_mtok = ?, output_price_per_mtok = ?, supports_vision = ?,
        supports_function_calling = ?, supports_json_mode = ?, supports_streaming = ?, supports_web_search = ?, is_favorite = ?, is_hidden = ?,
        reasoning = ?, task_quality = ?, latency = ?, generation_speed = ?, hallucinations = ?,
        instruction_following = ?, code_quality = ?, multilingual_quality = ?, robustness = ?,
        rag_compatibility = ?, release_date = ?, description = ?, use_cases = ?, pros = ?, cons = ?, benchmarks = ?, tags = ?,
        info_updated_at = ?, availability_checked_at = ?, availability_status = ?, availability_response_ms = ?, availability_error = ?,
        updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      merged.name,
      provider,
      provider_id,
      merged.family,
      merged.modality,
      merged.context_window,
      merged.max_output_tokens,
      merged.input_price_per_mtok,
      merged.output_price_per_mtok,
      merged.supports_vision ? 1 : 0,
      merged.supports_function_calling ? 1 : 0,
      merged.supports_json_mode ? 1 : 0,
      merged.supports_streaming ? 1 : 0,
      merged.supports_web_search ? 1 : 0,
      merged.is_favorite ? 1 : 0,
      merged.is_hidden ? 1 : 0,
      merged.reasoning ?? 3,
      merged.task_quality ?? 3,
      merged.latency ?? 3,
      merged.generation_speed ?? 3,
      merged.hallucinations ?? 3,
      merged.instruction_following ?? 3,
      merged.code_quality ?? 3,
      merged.multilingual_quality ?? 3,
      merged.robustness ?? 3,
      merged.rag_compatibility ?? 3,
      merged.release_date ?? null,
      merged.description ?? '',
      normalizeJson(normalizeUseCasesField(merged.use_cases)),
      normalizeJson(merged.pros),
      normalizeJson(merged.cons),
      normalizeJson(merged.benchmarks),
      normalizeJson(merged.tags),
      merged.info_updated_at ?? null,
      merged.availability_checked_at ?? null,
      merged.availability_status ?? null,
      merged.availability_response_ms ?? null,
      merged.availability_error ?? null,
      now,
      id
    );
    return this.findById(id)!;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM models WHERE id = ?');
    const result = stmt.run(id);
    return (result as { changes: number }).changes > 0;
  }

  clearAll(): number {
    const result = this.db.prepare('DELETE FROM models').run();
    return (result as { changes: number }).changes;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM models').get() as { count: number };
    return row.count;
  }

  getProviders(): string[] {
    return providerRepository.getProviderNames();
  }

  getFamilies(): string[] {
    const stmt = this.db.prepare("SELECT DISTINCT family FROM models WHERE family != '' ORDER BY family");
    const rows = stmt.all() as { family: string }[];
    return rows.map((r) => r.family);
  }

  getModalities(): string[] {
    const stmt = this.db.prepare('SELECT DISTINCT modality FROM models ORDER BY modality');
    const rows = stmt.all() as { modality: string }[];
    return rows.map((r) => r.modality);
  }

  findByIds(ids: string[]): Model[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`${SELECT_ALL} WHERE id IN (${placeholders})`);
    const rows = stmt.all(...ids) as Record<string, unknown>[];
    return rows.map(rowToModel);
  }

  upsert(input: ModelInput): Model {
    if (input.id) {
      const existing = this.findById(input.id);
      if (existing) return this.update(input.id, input)!;
    }

    const byName = this.findByNormalizedName(input.name);
    if (byName) return this.update(byName.id, input)!;

    return this.create(input);
  }
}

export const modelRepository = new ModelRepository();
