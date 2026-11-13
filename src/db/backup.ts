import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackup, getBackupConfig, getSourceDbPath } from '../services/backupService.js';

async function main(): Promise<void> {
  const config = getBackupConfig();
  console.log(`Источник: ${getSourceDbPath()}`);
  console.log(`Каталог бэкапов: ${config.dir}`);

  const result = await createBackup();
  console.log(`Daily: ${result.dailyPath}`);
  if (result.weeklyPath) {
    console.log(`Weekly: ${result.weeklyPath}`);
  }
  console.log(`Страниц: ${result.pages}`);
  if (result.pruned.length > 0) {
    console.log(`Удалено устаревших: ${result.pruned.length}`);
  }
  console.log('Бэкап завершён успешно.');
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error('Ошибка бэкапа:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
