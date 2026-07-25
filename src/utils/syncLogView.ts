import type { SyncLogKind, SyncLogStatus } from '../types/syncLog.js';

export const SYNC_LOG_KIND_LABELS: Record<SyncLogKind, string> = {
  batch: 'Пакетное',
  single: 'Одна модель',
};

export const SYNC_LOG_STATUS_LABELS: Record<SyncLogStatus, string> = {
  completed: 'Завершено',
  partial: 'С ошибками',
  failed: 'Не удалось',
};

export function formatSyncLogDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${seconds} с`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes} мин ${rest} с`;
}

export function formatSyncValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
