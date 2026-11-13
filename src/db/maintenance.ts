import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { getDb } from './db.js';
import { deduplicateModels } from './deduplicateModels.js';
import {
  getProviderContainerIds,
  pruneBatchInferenceModels,
  pruneProviderContainers,
} from './pruneModels.js';
import { inferFamily } from '../utils/inferFamily.js';
import { recoverSyncLogs } from './recoverSyncLogs.js';

const catalogPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../docs/bothub-catalog.json');

export function runMaintenance(): void {
  const db = getDb();

  db.exec("UPDATE models SET family = provider WHERE family = '' AND provider != 'BotHub'");
  db.exec(`
    UPDATE models
    SET provider = 'BotHub',
        provider_id = (SELECT id FROM providers WHERE slug = 'bothub' LIMIT 1)
    WHERE provider != 'BotHub'
  `);

  const emptyFamilyRows = db.prepare("SELECT id, name FROM models WHERE family = ''").all() as {
    id: string;
    name: string;
  }[];
  if (emptyFamilyRows.length > 0) {
    const updateFamily = db.prepare('UPDATE models SET family = ? WHERE id = ?');
    for (const row of emptyFamilyRows) {
      updateFamily.run(inferFamily(row.name), row.id);
    }
    console.log(`Backfilled family for ${emptyFamilyRows.length} models.`);
  }

  const syncLogsRecover = recoverSyncLogs(db);
  if (syncLogsRecover !== 'ok') {
    console.log(`sync_logs recovery: ${syncLogsRecover}.`);
  }

  const removedBatch = pruneBatchInferenceModels(db);
  if (removedBatch > 0) {
    console.log(`Removed ${removedBatch} batch-inference pseudo-model(s).`);
  }

  const removed = deduplicateModels(db);
  if (removed > 0) {
    console.log(`Removed ${removed} duplicate model(s).`);
  }

  if (existsSync(catalogPath)) {
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Array<{
      id: string;
      children?: unknown[];
      providers?: unknown[];
    }>;
    const prunedContainers = pruneProviderContainers(db, getProviderContainerIds(catalog));
    if (prunedContainers > 0) {
      console.log(`Removed ${prunedContainers} provider container pseudo-model(s).`);
    }
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runMaintenance();
  console.log('Database maintenance completed.');
}
