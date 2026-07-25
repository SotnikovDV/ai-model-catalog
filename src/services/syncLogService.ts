import { syncLogRepository } from '../models/syncLogRepository.js';
import type { CreateSyncLogInput, SyncLog, SyncLogStatus, SyncLogSummary } from '../types/syncLog.js';
import type { SyncModelResult, SyncOptions, SyncResult } from '../types/sync.js';

export function buildSummaryFromResults(results: SyncModelResult[]): SyncLogSummary {
  return {
    updated: results.filter((item) => item.status === 'updated').length,
    created: results.filter((item) => item.status === 'created').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    errors: results.filter((item) => item.status === 'error').length,
  };
}

export function deriveSyncLogStatus(
  summary: SyncLogSummary,
  failed: boolean,
): SyncLogStatus {
  if (failed && summary.updated + summary.created + summary.skipped === 0) {
    return 'failed';
  }
  if (failed || summary.errors > 0) {
    return 'partial';
  }
  return 'completed';
}

function logToConsole(entry: SyncLog): void {
  const { kind, status, summary, durationMs, id, modelName } = entry;
  const scope = kind === 'single' && modelName ? `single:${modelName}` : kind;
  const message = `[sync] ${scope} ${status} updated=${summary.updated} created=${summary.created} skipped=${summary.skipped} errors=${summary.errors} duration=${durationMs}ms logId=${id}`;
  if (status === 'failed') {
    console.error(message, entry.errorMessage ?? '');
    return;
  }
  if (status === 'partial') {
    console.warn(message);
    return;
  }
  console.log(message);
}

export function writeSyncLog(input: CreateSyncLogInput): SyncLog {
  const entry = syncLogRepository.create(input);
  logToConsole(entry);
  return entry;
}

export function writeBatchSyncLog(params: {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  options: SyncOptions;
  result?: SyncResult;
  failed?: boolean;
  errorMessage?: string;
}): SyncLog {
  const results = params.result?.results ?? [];
  const summary = params.result
    ? {
        updated: params.result.updated,
        created: params.result.created,
        skipped: params.result.skipped,
        errors: params.result.errors,
      }
    : buildSummaryFromResults(results);
  const status = deriveSyncLogStatus(summary, Boolean(params.failed));

  return writeSyncLog({
    kind: 'batch',
    status,
    dryRun: params.options.dryRun,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    durationMs: params.durationMs,
    options: params.options,
    summary,
    errorMessage: params.errorMessage ?? null,
    results,
  });
}

export function writeSingleSyncLog(params: {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  options: SyncOptions;
  modelId: string;
  modelName: string;
  result?: SyncModelResult;
  failed?: boolean;
  errorMessage?: string;
}): SyncLog {
  const results = params.result ? [params.result] : [];
  const summary = buildSummaryFromResults(results);
  const status = deriveSyncLogStatus(summary, Boolean(params.failed));

  return writeSyncLog({
    kind: 'single',
    status,
    dryRun: params.options.dryRun,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    durationMs: params.durationMs,
    modelId: params.modelId,
    modelName: params.modelName,
    options: params.options,
    summary,
    errorMessage: params.errorMessage ?? null,
    results,
  });
}
