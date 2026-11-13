import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderSchema } from '../src/types/provider.js';

describe('ProviderSchema', () => {
  it('принимает валидного провайдера', () => {
    const result = ProviderSchema.parse({
      name: 'Test Provider',
      slug: 'test-provider',
      base_url: 'https://example.com/api/v1',
      models_url: 'https://example.com/models',
      catalog_source: 'custom',
    });

    expect(result.name).toBe('Test Provider');
    expect(result.slug).toBe('test-provider');
    expect(result.base_url).toBe('https://example.com/api/v1');
    expect(result.enabled).toBe(true);
  });

  it('принимает пустой base_url', () => {
    const result = ProviderSchema.parse({
      name: 'Test',
      slug: 'test',
      base_url: '',
      models_url: '',
    });
    expect(result.base_url).toBe('');
  });

  it('отклоняет некорректный slug', () => {
    expect(() =>
      ProviderSchema.parse({
        name: 'Bad',
        slug: 'Bad Slug',
      }),
    ).toThrow();
  });
});

describe('providerRepository', () => {
  let tempDir: string;
  let originalDbPath: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'providers-test-'));
    originalDbPath = process.env.DB_PATH;
    process.env.DB_PATH = join(tempDir, 'test.db');
    vi.resetModules();
  });

  afterEach(() => {
    process.env.DB_PATH = originalDbPath;
    vi.resetModules();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('создаёт seed-провайдеров после миграций', async () => {
    const { ensureSchema } = await import('../src/db/migrate.js');
    const { providerRepository } = await import('../src/models/providerRepository.js');

    ensureSchema();

    const providers = providerRepository.findAll();
    expect(providers.length).toBeGreaterThanOrEqual(3);
    expect(providerRepository.findBySlug('bothub')?.name).toBe('BotHub');
    expect(providerRepository.findBySlug('openrouter')?.name).toBe('OpenRouter');
    expect(providerRepository.findBySlug('routerai')?.name).toBe('RouterAI');
    expect(providerRepository.findBySlug('bothub')?.base_url).toBe('https://openai.bothub.chat/v1');
  });

  it('выполняет CRUD провайдера', async () => {
    const { ensureSchema } = await import('../src/db/migrate.js');
    const { providerRepository } = await import('../src/models/providerRepository.js');

    ensureSchema();

    const created = providerRepository.create({
      name: 'Custom Source',
      slug: 'custom-source',
      enabled: true,
      base_url: 'https://example.com/api/v1',
      models_url: 'https://example.com/api/models',
      api_key: 'secret-key',
      catalog_source: 'custom',
    });

    expect(created.id).toBeTruthy();
    expect(providerRepository.findById(created.id)?.api_key).toBe('secret-key');

    const updated = providerRepository.update(created.id, { enabled: false });
    expect(updated?.enabled).toBe(false);

    expect(providerRepository.delete(created.id)).toBe(true);
    expect(providerRepository.findById(created.id)).toBeNull();
  });

  it('backfill provider_id для моделей', async () => {
    const { ensureSchema } = await import('../src/db/migrate.js');
    const { modelRepository } = await import('../src/models/modelRepository.js');
    const { providerRepository } = await import('../src/models/providerRepository.js');

    ensureSchema();

    const bothub = providerRepository.getBotHub();
    expect(bothub).toBeTruthy();

    const models = modelRepository.findAll();
    if (models.length > 0) {
      for (const model of models) {
        expect(model.provider_id).toBe(bothub!.id);
      }
    }
  });
});

describe('migrations 004–006', () => {
  let tempDir: string;
  let originalDbPath: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'providers-mig-test-'));
    originalDbPath = process.env.DB_PATH;
    process.env.DB_PATH = join(tempDir, 'test.db');
    vi.resetModules();
  });

  afterEach(() => {
    process.env.DB_PATH = originalDbPath;
    vi.resetModules();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('идемпотентны при повторном запуске', async () => {
    const { getDb } = await import('../src/db/db.js');
    const { runMigrations } = await import('../src/db/migrationRunner.js');
    const db = getDb();

    const first = runMigrations(db);
    const second = runMigrations(db);

    expect(first).toContain('004_providers');
    expect(first).toContain('005_models_provider_id');
    expect(first).toContain('006_providers_base_url');
    expect(second).toEqual([]);

    const bothub = db.prepare("SELECT base_url FROM providers WHERE slug = 'bothub'").get() as { base_url: string };
    expect(bothub.base_url).toBe('https://openai.bothub.chat/v1');

    const providers = db.prepare('SELECT COUNT(*) as count FROM providers').get() as { count: number };
    expect(providers.count).toBe(3);
  });
});
