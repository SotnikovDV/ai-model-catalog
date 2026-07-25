import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db.js';
import { getProviderContainerIds, pruneModelsNotInAllowedSet, pruneProviderContainers } from './pruneModels.js';
import { normalizeModelName } from '../utils/normalizeModelName.js';

const projectRoot = process.cwd();
const exportPath = path.join(projectRoot, 'docs/bothub_models.json');
const catalogPath = path.join(projectRoot, 'docs/bothub-catalog.json');

function loadAllowedNamesFromExport(): Set<string> {
  if (!existsSync(exportPath)) {
    throw new Error(`Файл не найден: ${exportPath}`);
  }
  const payload = JSON.parse(readFileSync(exportPath, 'utf8')) as { data: Array<{ name: string }> };
  if (!Array.isArray(payload.data)) {
    throw new Error('Ожидается поле data — массив моделей в bothub_models.json');
  }
  return new Set(payload.data.map((m) => normalizeModelName(m.name)));
}

function loadProviderContainersFromCatalog(): Set<string> {
  if (!existsSync(catalogPath)) return new Set();
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Array<{
    id: string;
    children?: unknown[];
    providers?: unknown[];
  }>;
  return getProviderContainerIds(catalog);
}

export function pruneToCanonicalExport(): { removedExtras: number; removedContainers: number; total: number } {
  const db = getDb();
  const allowed = loadAllowedNamesFromExport();
  const removedExtras = pruneModelsNotInAllowedSet(db, allowed);

  const containers = loadProviderContainersFromCatalog();
  const removedContainers = pruneProviderContainers(db, containers);

  const total = (db.prepare('SELECT COUNT(*) as count FROM models').get() as { count: number }).count;
  return { removedExtras, removedContainers, total };
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = pruneToCanonicalExport();
  console.log(`Удалено лишних моделей: ${result.removedExtras}`);
  if (result.removedContainers > 0) {
    console.log(`Удалено узлов-провайдеров: ${result.removedContainers}`);
  }
  console.log(`Осталось моделей: ${result.total}`);
}
