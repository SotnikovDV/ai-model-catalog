import { randomUUID } from 'node:crypto';
import { getDb } from '../db/db.js';
import type {
  CreateSyncLogInput,
  SyncLog,
  SyncLogListItem,
  SyncLogSummary,
} from '../types/syncLog.js';
import type { SyncModelResult } from '../types/sync.js';

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToListItem(row: Record<string, unknown>): SyncLogListItem {
  return {
    id: row.id as string,
    kind: row.kind as SyncLogListItem['kind'],
    status: row.status as SyncLogListItem['status'],
    dryRun: Boolean(row.dry_run),
    startedAt: row.started_at as string,
    finishedAt: row.finished_at as string,
    durationMs: row.duration_ms as number,
    modelId: (row.model_id as string | null) ?? null,
    modelName: (row.model_name as string | null) ?? null,
    summary: parseJson<SyncLogSummary>(row.summary_json as string, {
      updated: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    }),
    errorMessage: (row.error_message as string | null) ?? null,
  };
}

function rowToLog(row: Record<string, unknown>): SyncLog {
  const listItem = rowToListItem(row);
  return {
    ...listItem,
    options: parseJson(row.options_json as string, {}),
    results: parseJson<SyncModelResult[]>(row.results_json as string, []),
  };
}

export class SyncLogRepository {
  private db = getDb();

  create(input: CreateSyncLogInput): SyncLog {
    const id = randomUUID();
    const summary = input.summary ?? { updated: 0, created: 0, skipped: 0, errors: 0 };
    const stmt = this.db.prepare(`
      INSERT INTO sync_logs (
        id, kind, status, dry_run, started_at, finished_at, duration_ms,
        model_id, model_name, options_json, summary_json, error_message, results_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.kind,
      input.status,
      input.dryRun ? 1 : 0,
      input.startedAt,
      input.finishedAt,
      input.durationMs,
      input.modelId ?? null,
      input.modelName ?? null,
      JSON.stringify(input.options ?? {}),
      JSON.stringify(summary),
      input.errorMessage ?? null,
      JSON.stringify(input.results ?? []),
    );

    const created = this.findById(id);
    if (!created) {
      throw new Error('Не удалось сохранить запись журнала sync');
    }
    return created;
  }

  findRecent(limit = 50, offset = 0): SyncLogListItem[] {
    const stmt = this.db.prepare(`
      SELECT id, kind, status, dry_run, started_at, finished_at, duration_ms,
             model_id, model_name, summary_json, error_message
      FROM sync_logs
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as Record<string, unknown>[];
    return rows.map(rowToListItem);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM sync_logs').get() as { count: number };
    return row.count;
  }

  findById(id: string): SyncLog | null {
    const row = this.db.prepare(`
      SELECT id, kind, status, dry_run, started_at, finished_at, duration_ms,
             model_id, model_name, options_json, summary_json, error_message, results_json
      FROM sync_logs
      WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;

    return row ? rowToLog(row) : null;
  }
}

export const syncLogRepository = new SyncLogRepository();
