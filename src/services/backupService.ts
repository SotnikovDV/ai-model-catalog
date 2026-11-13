import { backup, DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import * as path from 'node:path';
import { DB_PATH, getDb } from '../db/db.js';

const DAILY_PREFIX = 'models-daily-';
const WEEKLY_PREFIX = 'models-weekly-';
const DB_SUFFIX = '.db';

export interface BackupConfig {
  enabled: boolean;
  dir: string;
  hour: number;
  keepDaily: number;
  keepWeekly: number;
}

export interface BackupResult {
  dailyPath: string;
  weeklyPath: string | null;
  pages: number;
  pruned: string[];
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function parseIntInRange(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const int = Math.trunc(value);
  if (int < min || int > max) return fallback;
  return int;
}

export function getBackupConfig(): BackupConfig {
  const projectRoot = process.cwd();
  const dirRaw = process.env.BACKUP_DIR?.trim() || './backups';
  return {
    enabled: parseBool(process.env.BACKUP_ENABLED, false),
    dir: path.resolve(projectRoot, dirRaw),
    hour: parseIntInRange(process.env.BACKUP_HOUR, 3, 0, 23),
    keepDaily: parseIntInRange(process.env.BACKUP_KEEP_DAILY, 7, 1, 365),
    keepWeekly: parseIntInRange(process.env.BACKUP_KEEP_WEEKLY, 4, 1, 52),
  };
}

export function formatBackupDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailyBackupFileName(date: Date = new Date()): string {
  return `${DAILY_PREFIX}${formatBackupDate(date)}${DB_SUFFIX}`;
}

export function weeklyBackupFileName(date: Date = new Date()): string {
  return `${WEEKLY_PREFIX}${formatBackupDate(date)}${DB_SUFFIX}`;
}

export function isSunday(date: Date = new Date()): boolean {
  return date.getDay() === 0;
}

export function dailyBackupPathForDate(dir: string, date: Date = new Date()): string {
  return path.join(dir, dailyBackupFileName(date));
}

function listBackupFiles(dir: string, prefix: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(DB_SUFFIX))
    .sort()
    .reverse();
}

export function pruneBackups(
  dir: string,
  keepDaily: number,
  keepWeekly: number,
): string[] {
  const removed: string[] = [];

  const prune = (prefix: string, keep: number) => {
    const files = listBackupFiles(dir, prefix);
    for (const name of files.slice(Math.max(0, keep))) {
      const fullPath = path.join(dir, name);
      try {
        unlinkSync(fullPath);
        removed.push(fullPath);
      } catch (error) {
        console.warn(`[backup] Не удалось удалить ${fullPath}:`, error);
      }
    }
  };

  prune(DAILY_PREFIX, keepDaily);
  prune(WEEKLY_PREFIX, keepWeekly);
  return removed;
}

function assertBackupIntegrity(filePath: string): void {
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    const rows = db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>;
    const ok = rows.length === 1 && rows[0]?.integrity_check === 'ok';
    if (!ok) {
      const details = rows.map((row) => row.integrity_check).join('; ');
      throw new Error(`integrity_check failed: ${details}`);
    }
  } finally {
    db.close();
  }
}

function ensureBackupDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Создаёт daily-снимок; в воскресенье — ещё и weekly. Затем ротация. */
export async function createBackup(now: Date = new Date()): Promise<BackupResult> {
  const config = getBackupConfig();
  ensureBackupDir(config.dir);

  const dailyPath = dailyBackupPathForDate(config.dir, now);
  const tempPath = `${dailyPath}.tmp`;

  if (existsSync(tempPath)) {
    unlinkSync(tempPath);
  }

  const sourceDb = getDb();
  let pages = 0;
  try {
    pages = await backup(sourceDb, tempPath);
    assertBackupIntegrity(tempPath);
    if (existsSync(dailyPath)) {
      unlinkSync(dailyPath);
    }
    renameSync(tempPath, dailyPath);
  } catch (error) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }

  let weeklyPath: string | null = null;
  if (isSunday(now)) {
    weeklyPath = path.join(config.dir, weeklyBackupFileName(now));
    copyFileSync(dailyPath, weeklyPath);
  }

  const pruned = pruneBackups(config.dir, config.keepDaily, config.keepWeekly);

  return {
    dailyPath,
    weeklyPath,
    pages,
    pruned,
  };
}

export function hasDailyBackupForDate(dir: string, date: Date = new Date()): boolean {
  return existsSync(dailyBackupPathForDate(dir, date));
}

export function getSourceDbPath(): string {
  return DB_PATH;
}
