import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  dailyBackupFileName,
  formatBackupDate,
  isSunday,
  pruneBackups,
  weeklyBackupFileName,
} from '../src/services/backupService.js';

describe('backup naming', () => {
  it('форматирует дату и имена файлов', () => {
    const date = new Date(2026, 7, 21); // 21 Aug 2026, Friday
    expect(formatBackupDate(date)).toBe('2026-08-21');
    expect(dailyBackupFileName(date)).toBe('models-daily-2026-08-21.db');
    expect(weeklyBackupFileName(date)).toBe('models-weekly-2026-08-21.db');
    expect(isSunday(date)).toBe(false);
    expect(isSunday(new Date(2026, 7, 23))).toBe(true);
  });
});

describe('pruneBackups', () => {
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

  it('оставляет N daily и M weekly, чужие файлы не трогает', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'backup-prune-'));
    mkdirSync(tempDir, { recursive: true });

    const touch = (name: string) => writeFileSync(join(tempDir, name), 'x');

    for (let day = 1; day <= 10; day += 1) {
      touch(`models-daily-2026-08-${String(day).padStart(2, '0')}.db`);
    }
    for (let week = 1; week <= 6; week += 1) {
      touch(`models-weekly-2026-0${week}-01.db`);
    }
    touch('readme.txt');
    touch('models-manual-copy.db');

    const removed = pruneBackups(tempDir, 7, 4);
    expect(removed).toHaveLength(3 + 2); // 3 daily + 2 weekly

    const left = readdirSync(tempDir).sort();
    expect(left).toEqual([
      'models-daily-2026-08-04.db',
      'models-daily-2026-08-05.db',
      'models-daily-2026-08-06.db',
      'models-daily-2026-08-07.db',
      'models-daily-2026-08-08.db',
      'models-daily-2026-08-09.db',
      'models-daily-2026-08-10.db',
      'models-manual-copy.db',
      'models-weekly-2026-03-01.db',
      'models-weekly-2026-04-01.db',
      'models-weekly-2026-05-01.db',
      'models-weekly-2026-06-01.db',
      'readme.txt',
    ]);
  });
});
