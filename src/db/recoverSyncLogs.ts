import type { DatabaseSync } from 'node:sqlite';
import { CREATE_SYNC_LOGS_INDEXES_SQL, CREATE_SYNC_LOGS_TABLE_SQL } from './syncLogSchema.js';

export type SyncLogsRecoverResult = 'ok' | 'reindexed' | 'recreated';

function canReadSyncLogs(db: DatabaseSync): boolean {
  try {
    db.prepare('SELECT COUNT(*) AS count FROM sync_logs').get();
    db.prepare(`
      SELECT id FROM sync_logs
      ORDER BY started_at DESC
      LIMIT 1
    `).get();
    return true;
  } catch {
    return false;
  }
}

function recreateSyncLogs(db: DatabaseSync): void {
  db.exec('DROP TABLE IF EXISTS sync_logs');
  db.exec(CREATE_SYNC_LOGS_TABLE_SQL);
  db.exec(CREATE_SYNC_LOGS_INDEXES_SQL);
}

/** Восстанавливает читаемость журнала sync. При невозможности — пересоздаёт пустую таблицу. */
export function recoverSyncLogs(db: DatabaseSync): SyncLogsRecoverResult {
  if (canReadSyncLogs(db)) return 'ok';

  try {
    db.exec('REINDEX');
    if (canReadSyncLogs(db)) return 'reindexed';
  } catch {
    // таблица или страницы повреждены — пересоздаём журнал
  }

  recreateSyncLogs(db);
  console.warn('Таблица sync_logs повреждена и пересоздана. История журнала очищена.');
  return 'recreated';
}
