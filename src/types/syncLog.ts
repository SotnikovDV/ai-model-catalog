import type { SyncModelResult, SyncOptions } from './sync.js';

export type SyncLogKind = 'batch' | 'single';

export type SyncLogStatus = 'completed' | 'partial' | 'failed';

export interface SyncLogSummary {
  updated: number;
  created: number;
  skipped: number;
  errors: number;
}

export interface SyncLog {
  id: string;
  kind: SyncLogKind;
  status: SyncLogStatus;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  modelId?: string | null;
  modelName?: string | null;
  options: Partial<SyncOptions>;
  summary: SyncLogSummary;
  errorMessage?: string | null;
  results: SyncModelResult[];
}

export interface SyncLogListItem {
  id: string;
  kind: SyncLogKind;
  status: SyncLogStatus;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  modelId?: string | null;
  modelName?: string | null;
  summary: SyncLogSummary;
  errorMessage?: string | null;
}

export interface CreateSyncLogInput {
  kind: SyncLogKind;
  status: SyncLogStatus;
  dryRun?: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  modelId?: string | null;
  modelName?: string | null;
  options?: Partial<SyncOptions>;
  summary?: SyncLogSummary;
  errorMessage?: string | null;
  results?: SyncModelResult[];
}
