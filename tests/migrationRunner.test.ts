import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runMigrations', () => {
  let tempDir: string;
  let originalDbPath: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'migrations-test-'));
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

  it('применяет миграции один раз', async () => {
    const { getDb } = await import('../src/db/db.js');
    const { runMigrations, listMigrations } = await import('../src/db/migrationRunner.js');
    const db = getDb();

    const first = runMigrations(db);
    const second = runMigrations(db);

    expect(first).toEqual(listMigrations());
    expect(second).toEqual([]);
    expect(first.length).toBeGreaterThanOrEqual(6);
  });

  it('создаёт таблицу schema_migrations', async () => {
    const { getDb } = await import('../src/db/db.js');
    const { runMigrations } = await import('../src/db/migrationRunner.js');
    const db = getDb();

    runMigrations(db);

    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
    expect(row).toBeTruthy();
  });
});
