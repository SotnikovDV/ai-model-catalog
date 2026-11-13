import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { recoverSyncLogs } from '../src/db/recoverSyncLogs.js';
import { CREATE_SYNC_LOGS_INDEXES_SQL, CREATE_SYNC_LOGS_TABLE_SQL } from '../src/db/syncLogSchema.js';
import { isSqliteCorruptError } from '../src/utils/sqliteErrors.js';

describe('isSqliteCorruptError', () => {
  it('распознаёт malformed SQLite', () => {
    expect(isSqliteCorruptError(new Error('database disk image is malformed'))).toBe(true);
    expect(isSqliteCorruptError(new Error('file is not a database'))).toBe(true);
    expect(isSqliteCorruptError(new Error('Не удалось сохранить запись'))).toBe(false);
  });
});

describe('recoverSyncLogs', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('не трогает читаемую таблицу', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'sync-logs-ok-'));
    const db = new DatabaseSync(join(tempDir, 'test.db'));
    db.exec(CREATE_SYNC_LOGS_TABLE_SQL);
    db.exec(CREATE_SYNC_LOGS_INDEXES_SQL);
    db.prepare(`
      INSERT INTO sync_logs (
        id, kind, status, dry_run, started_at, finished_at, duration_ms,
        options_json, summary_json, results_json
      ) VALUES (?, 'batch', 'completed', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', 1000, '{}', '{}', '[]')
    `).run('keep-me');

    expect(recoverSyncLogs(db)).toBe('ok');
    const row = db.prepare('SELECT COUNT(*) AS count FROM sync_logs').get() as { count: number };
    expect(row.count).toBe(1);
    db.close();
  });

  it('пересоздаёт отсутствующую таблицу журнала', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'sync-logs-missing-'));
    const db = new DatabaseSync(join(tempDir, 'test.db'));

    expect(recoverSyncLogs(db)).toBe('recreated');
    const row = db.prepare('SELECT COUNT(*) AS count FROM sync_logs').get() as { count: number };
    expect(row.count).toBe(0);
    db.close();
  });
});
