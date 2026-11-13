import {
  createBackup,
  getBackupConfig,
  hasDailyBackupForDate,
} from './backupService.js';

const CHECK_INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function maybeRunScheduledBackup(): Promise<void> {
  if (running) return;

  const config = getBackupConfig();
  if (!config.enabled) return;

  const now = new Date();
  if (now.getHours() !== config.hour) return;
  if (hasDailyBackupForDate(config.dir, now)) return;

  running = true;
  try {
    const result = await createBackup(now);
    const weekly = result.weeklyPath ? ` weekly=${result.weeklyPath}` : '';
    console.log(
      `[backup] scheduled ok daily=${result.dailyPath}${weekly} pages=${result.pages} pruned=${result.pruned.length}`,
    );
  } catch (error) {
    console.error('[backup] scheduled failed:', error);
  } finally {
    running = false;
  }
}

export function startBackupScheduler(): void {
  const config = getBackupConfig();
  if (!config.enabled) {
    console.log('[backup] scheduler disabled (BACKUP_ENABLED=false)');
    return;
  }

  if (timer) return;

  console.log(
    `[backup] scheduler enabled dir=${config.dir} hour=${config.hour} keepDaily=${config.keepDaily} keepWeekly=${config.keepWeekly}`,
  );

  void maybeRunScheduledBackup();
  timer = setInterval(() => {
    void maybeRunScheduledBackup();
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
}

export function stopBackupScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
