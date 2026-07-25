import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ensureSchema', () => {
  let tempDir: string;
  let originalDbPath: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'migrate-test-'));
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

  it('не вызывает deduplicateModels при старте', async () => {
    const dedupe = vi.fn(() => 0);
    vi.doMock('../src/db/deduplicateModels.js', () => ({
      deduplicateModels: dedupe,
    }));

    const { ensureSchema } = await import('../src/db/migrate.js');
    ensureSchema();

    expect(dedupe).not.toHaveBeenCalled();
  }, 15_000);

  it('создаёт seed-модели при пустой БД', async () => {
    const { ensureSchema } = await import('../src/db/migrate.js');
    const { getDb } = await import('../src/db/db.js');

    ensureSchema();

    const count = getDb().prepare('SELECT COUNT(*) as count FROM models').get() as { count: number };
    expect(count.count).toBeGreaterThan(0);
  });
});

describe('runMaintenance', () => {
  let tempDir: string;
  let originalDbPath: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'maintenance-test-'));
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

  it('выполняет deduplicateModels', async () => {
    const dedupe = vi.fn(() => 2);
    vi.doMock('../src/db/deduplicateModels.js', () => ({
      deduplicateModels: dedupe,
    }));

    const { ensureSchema } = await import('../src/db/migrate.js');
    const { runMaintenance } = await import('../src/db/maintenance.js');
    ensureSchema();
    runMaintenance();

    expect(dedupe).toHaveBeenCalledOnce();
  });
});
