import { getDb } from '../db/db.js';
import type {
  Provider,
  ProviderInput,
  ProviderPublic,
  ProviderUpdateInput,
} from '../types/provider.js';

const SELECT_ALL = `
  SELECT id, name, slug, enabled, base_url, models_url, api_key, catalog_source, created_at, updated_at
  FROM providers
`;

function maskApiKey(apiKey: string): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 4) return '****';
  return `${'*'.repeat(Math.min(apiKey.length - 4, 12))}${apiKey.slice(-4)}`;
}

function rowToProvider(row: Record<string, unknown>): Provider {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    enabled: Boolean(row.enabled),
    base_url: row.base_url as string,
    models_url: row.models_url as string,
    api_key: row.api_key as string,
    catalog_source: row.catalog_source as Provider['catalog_source'],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function toProviderPublic(provider: Provider): ProviderPublic {
  return {
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    enabled: provider.enabled,
    base_url: provider.base_url,
    models_url: provider.models_url,
    catalog_source: provider.catalog_source,
    apiKeySet: Boolean(provider.api_key),
    apiKeyHint: maskApiKey(provider.api_key),
    created_at: provider.created_at,
    updated_at: provider.updated_at,
  };
}

export class ProviderRepository {
  private db = getDb();

  findAll(): Provider[] {
    const rows = this.db.prepare(`${SELECT_ALL} ORDER BY name`).all() as Record<string, unknown>[];
    return rows.map(rowToProvider);
  }

  findAllEnabled(): Provider[] {
    const rows = this.db
      .prepare(`${SELECT_ALL} WHERE enabled = 1 ORDER BY name`)
      .all() as Record<string, unknown>[];
    return rows.map(rowToProvider);
  }

  findById(id: string): Provider | null {
    const row = this.db.prepare(`${SELECT_ALL} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? rowToProvider(row) : null;
  }

  findBySlug(slug: string): Provider | null {
    const row = this.db
      .prepare(`${SELECT_ALL} WHERE LOWER(slug) = LOWER(?)`)
      .get(slug) as Record<string, unknown> | undefined;
    return row ? rowToProvider(row) : null;
  }

  findByNameOrSlug(value: string): Provider | null {
    const row = this.db
      .prepare(`${SELECT_ALL} WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)`)
      .get(value, value) as Record<string, unknown> | undefined;
    return row ? rowToProvider(row) : null;
  }

  getBotHub(): Provider | null {
    return this.findBySlug('bothub');
  }

  countModels(providerId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM models WHERE provider_id = ?')
      .get(providerId) as { count: number };
    return row.count;
  }

  create(input: ProviderInput): Provider {
    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO providers (
        id, name, slug, enabled, base_url, models_url, api_key, catalog_source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.slug,
      input.enabled ? 1 : 0,
      input.base_url ?? '',
      input.models_url ?? '',
      input.api_key ?? '',
      input.catalog_source,
      now,
      now,
    );
    return this.findById(id)!;
  }

  update(id: string, input: ProviderUpdateInput): Provider | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const next = {
      name: input.name ?? existing.name,
      slug: input.slug ?? existing.slug,
      enabled: input.enabled ?? existing.enabled,
      models_url: input.models_url ?? existing.models_url,
      base_url: input.base_url ?? existing.base_url,
      api_key: input.api_key !== undefined && input.api_key.trim() !== ''
        ? input.api_key.trim()
        : existing.api_key,
      catalog_source: input.catalog_source ?? existing.catalog_source,
    };
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE providers SET
        name = ?, slug = ?, enabled = ?, base_url = ?, models_url = ?, api_key = ?,
        catalog_source = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.name,
      next.slug,
      next.enabled ? 1 : 0,
      next.base_url,
      next.models_url,
      next.api_key,
      next.catalog_source,
      now,
      id,
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM providers WHERE id = ?').run(id);
    return (result as { changes: number }).changes > 0;
  }

  getProviderNames(): string[] {
    return this.findAllEnabled().map((p) => p.name);
  }
}

export const providerRepository = new ProviderRepository();
